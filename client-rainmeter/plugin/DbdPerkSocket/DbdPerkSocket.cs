/*
 * DbdPerkSocket - Rainmeter plugin
 *
 * A minimal WebSocket client measure for Rainmeter. Connects to a plain
 * (non-Socket.IO) WebSocket server, listens for perk-sync messages, and
 * exposes the 4 current perk image URLs as section-variable functions
 * ([MeasureName:Perk(1)] .. [MeasureName:Perk(4)]) that a WebParser
 * measure can download and an Image meter can display.
 *
 * Build with the official Rainmeter Plugin SDK (C#):
 *   https://github.com/rainmeter/rainmeter-plugin-sdk
 * Requires Visual Studio 2022 + Rainmeter 4.5 or higher (tested target: 4.5.26).
 *
 * HOW TO SET THIS UP:
 *   1. Clone/download the SDK above.
 *   2. Copy the "PluginEmpty" folder under C#\ to a new folder, e.g. "DbdPerkSocket",
 *      following the steps on https://docs.rainmeter.net/developers/
 *      (rename project, regenerate the GUID with GuidGen.exe Format 4, add it
 *      to SDK-CS.sln).
 *   3. Replace the generated .cs file's contents with this file.
 *   4. Build Release, both x86 and x64 (Rainmeter needs a DLL matching its own
 *      bitness).
 *   5. Drop the resulting DbdPerkSocket.dll into the skin's folder (or bundle
 *      it inside a .rmskin package so it installs automatically).
 *
 * Skin usage (see PerkDisplay.ini):
 *   [WebSocketMeasure]
 *   Measure=Plugin
 *   Plugin=DbdPerkSocket.dll
 *   Address=ws://yourserver:PORT/ws?room=CODE
 *   CacheFolder=#CURRENTPATH#Cache\        ; REQUIRED - where images are cached
 *   OnConnect=[bang to run when connected]
 *   OnMessage=[bang to run whenever a new perk message arrives]
 *   OnDisconnect=[bang to run on disconnect / before a retry]
 *
 * Expected message format from the server (plain JSON text frame):
 *   {"perks":["https://.../perk1.png","https://.../perk2.png","https://.../perk3.png","https://.../perk4.png"]}
 */

using Rainmeter;
using System;
using System.IO;
using System.Net.Http;
using System.Net.WebSockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;

namespace DbdPerkSocket
{
    class Measure
    {
        // Lets us write "(Measure)data" instead of spelling out GCHandle every time.
        static public implicit operator Measure(IntPtr data)
        {
            return (Measure)GCHandle.FromIntPtr(data).Target;
        }

        // Shared across all instances - a single long-lived HttpClient is the
        // recommended .NET pattern (creating one per request/download risks
        // socket exhaustion under load).
        static readonly HttpClient http = new HttpClient();

        internal API api;

        string address = "";
        string cacheFolder = "";
        string onConnectBang = "";
        string onMessageBang = "";
        string onDisconnectBang = "";

        ClientWebSocket socket;
        CancellationTokenSource cts;

        readonly object sync = new object();
        string lastMessage = "";
        readonly string[] perkUrls = new string[4] { "", "", "", "" };

        internal void Reload(API api, ref double maxValue)
        {
            this.api = api;

            string newAddress = api.ReadString("Address", "");
            cacheFolder = api.ReadPath("CacheFolder", "");
            onConnectBang = api.ReadString("OnConnect", "");
            onMessageBang = api.ReadString("OnMessage", "");
            onDisconnectBang = api.ReadString("OnDisconnect", "");

            api.Log(API.LogType.Notice, "DbdPerkSocket: Reload - Address=[" + newAddress + "]");
            api.Log(API.LogType.Notice, "DbdPerkSocket: OnMessage bang = [" + onMessageBang + "]");

            if (string.IsNullOrEmpty(cacheFolder))
            {
                api.Log(API.LogType.Warning, "DbdPerkSocket: CacheFolder is not set - add CacheFolder=#CURRENTPATH#Cache\\ to this measure's section, images will not be cached");
            }
            else
            {
                try
                {
                    Directory.CreateDirectory(cacheFolder);
                }
                catch (Exception ex)
                {
                    api.Log(API.LogType.Error, "DbdPerkSocket: could not create CacheFolder - " + ex.Message);
                }
            }

            // Only (re)connect if the address actually changed - Reload can be
            // called on every skin refresh, and we don't want to drop a live
            // connection just because the skin was refreshed for an unrelated reason.
            if (newAddress != address)
            {
                address = newAddress;
                Connect();
            }
        }

        void Connect()
        {
            cts?.Cancel();
            cts = new CancellationTokenSource();

            if (string.IsNullOrEmpty(address))
            {
                return;
            }

            Task.Run(() => RunLoop(address, cts.Token));
        }

        async Task RunLoop(string uri, CancellationToken token)
        {
            while (!token.IsCancellationRequested)
            {
                try
                {
                    using (socket = new ClientWebSocket())
                    {
                        await socket.ConnectAsync(new Uri(uri), token);
                        api?.Log(API.LogType.Notice, "DbdPerkSocket: WebSocket connected to " + uri);
                        FireBang(onConnectBang);

                        var buffer = new byte[8192];
                        while (socket.State == WebSocketState.Open && !token.IsCancellationRequested)
                        {
                            string message = await ReceiveFullMessage(socket, buffer, token);
                            if (message == null)
                            {
                                break; // server closed the connection
                            }
                            HandleMessage(message);
                        }
                    }
                }
                catch (OperationCanceledException)
                {
                    return; // Reload/Finalize asked us to stop
                }
                catch (Exception ex)
                {
                    api?.Log(API.LogType.Warning, "DbdPerkSocket: " + ex.Message);
                }

                FireBang(onDisconnectBang);

                if (token.IsCancellationRequested)
                {
                    return;
                }

                // Simple fixed retry delay. Good enough for a hobby project;
                // swap for exponential backoff if you're hammering the server.
                try
                {
                    await Task.Delay(2000, token);
                }
                catch (OperationCanceledException)
                {
                    return;
                }
            }
        }

        static async Task<string> ReceiveFullMessage(ClientWebSocket socket, byte[] buffer, CancellationToken token)
        {
            using (var ms = new MemoryStream())
            {
                WebSocketReceiveResult result;
                do
                {
                    result = await socket.ReceiveAsync(new ArraySegment<byte>(buffer), token);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        return null;
                    }
                    ms.Write(buffer, 0, result.Count);
                }
                while (!result.EndOfMessage);

                return Encoding.UTF8.GetString(ms.ToArray());
            }
        }

        // Deliberately not a full JSON parser - we only ever expect one shape
        // of message from our own server, so a couple of regexes keep this
        // plugin dependency-free (no Newtonsoft.Json.dll to ship alongside it).
        //
        // Matches EITHER the literal `null` OR a quoted string, in order, so
        // empty slots (which the server sends as JSON null, not "") don't
        // shift later real values into the wrong index.
        void HandleMessage(string json)
        {
            api?.Log(API.LogType.Notice, "DbdPerkSocket: received message: " + json);

            var urls = new string[4] { "", "", "", "" };

            var arrayMatch = Regex.Match(json, "\"perks\"\\s*:\\s*\\[(.*?)\\]", RegexOptions.Singleline);
            if (arrayMatch.Success)
            {
                var items = Regex.Matches(arrayMatch.Groups[1].Value, "null|\"([^\"]*)\"");
                for (int i = 0; i < 4 && i < items.Count; i++)
                {
                    var m = items[i];
                    urls[i] = m.Value == "null" ? "" : m.Groups[1].Value;
                }
            }

            api?.Log(API.LogType.Notice, "DbdPerkSocket: parsed -> [1]=" + urls[0] + " [2]=" + urls[1] + " [3]=" + urls[2] + " [4]=" + urls[3]);

            // Resolve each URL to a local cached file BEFORE touching any
            // skin state. EnsureCached only hits the network if the file
            // isn't already on disk, so re-picking the same perk later -
            // even across a restart - is instant instead of re-downloading.
            var paths = new string[4];
            for (int i = 0; i < 4; i++)
            {
                paths[i] = string.IsNullOrEmpty(urls[i]) ? "" : EnsureCached(urls[i]);
            }

            lock (sync)
            {
                lastMessage = json;
                Array.Copy(paths, perkUrls, 4);
            }

            // Push each resolved LOCAL path straight into its Image meter.
            // No WebParser measure needed for this anymore - the plugin
            // already has the file on disk by this point, so there's
            // nothing left for WebParser's own Download mechanism to do.
            for (int i = 0; i < 4; i++)
            {
                string imageMeter = $"Perk{i + 1}Image";
                string localPath = perkUrls[i];

                if (!string.IsNullOrEmpty(localPath))
                {
                    api?.Execute($"[!SetOption {imageMeter} ImageName \"{localPath}\"][!UpdateMeter {imageMeter}][!Redraw]");
                }
                else
                {
                    api?.Execute($"[!SetOption {imageMeter} ImageName \"\"][!UpdateMeter {imageMeter}][!Redraw]");
                }
            }

            FireBang(onMessageBang);
        }

        // Downloads a perk image to CacheFolder only if it isn't already
        // there, and returns the local path either way. The cache key is
        // just the filename from the URL, so re-picking the same perk
        // later - even in a different room - reuses the same cached file
        // instead of re-fetching it.
        string EnsureCached(string url)
        {
            if (string.IsNullOrEmpty(cacheFolder))
            {
                return url; // nothing configured to cache into - warned about in Reload already
            }

            try
            {
                string filename = Path.GetFileName(new Uri(url).LocalPath);
                if (string.IsNullOrEmpty(filename))
                {
                    return url;
                }

                string localPath = Path.Combine(cacheFolder, filename);

                if (File.Exists(localPath))
                {
                    return localPath;
                }

                api?.Log(API.LogType.Notice, "DbdPerkSocket: caching " + url + " -> " + localPath);
                byte[] data = http.GetByteArrayAsync(url).GetAwaiter().GetResult();
                File.WriteAllBytes(localPath, data);
                return localPath;
            }
            catch (Exception ex)
            {
                api?.Log(API.LogType.Error, "DbdPerkSocket: failed to cache " + url + " - " + ex.Message);
                return url;
            }
        }

        void FireBang(string bang)
        {
            if (string.IsNullOrEmpty(bang))
            {
                api?.Log(API.LogType.Notice, "DbdPerkSocket: FireBang - bang string was empty, skipping");
                return;
            }
            if (api == null)
            {
                return;
            }

            api.Log(API.LogType.Notice, "DbdPerkSocket: FireBang - executing: " + bang);
            try
            {
                // Called from a background Task thread. RmExecute is commonly
                // called this way from async plugins; if it turns out to be
                // flaky in testing, the fallback is to set a "pending bang"
                // flag here and fire it from Update() on Rainmeter's own thread instead.
                api.Execute(bang);
                api.Log(API.LogType.Notice, "DbdPerkSocket: FireBang - Execute() returned normally");
            }
            catch (Exception ex)
            {
                api.Log(API.LogType.Error, "DbdPerkSocket: FireBang - Execute() threw: " + ex);
            }
        }

        internal double Update()
        {
            return 0.0; // we're a string/event measure, not a numeric one
        }

        internal string GetStringValue()
        {
            lock (sync) { return lastMessage; }
        }

        internal string GetPerk(int index)
        {
            lock (sync)
            {
                string value = (index >= 1 && index <= 4) ? perkUrls[index - 1] : "";
                api?.Log(API.LogType.Debug, "DbdPerkSocket: GetPerk(" + index + ") -> [" + value + "]");
                return value;
            }
        }

        internal void Dispose()
        {
            cts?.Cancel();
            try { socket?.Dispose(); } catch { /* ignore */ }
        }
    }

    public class Plugin
    {
        [DllExport]
        public static void Initialize(ref IntPtr data, IntPtr rm)
        {
            data = GCHandle.ToIntPtr(GCHandle.Alloc(new Measure()));
        }

        [DllExport]
        public static void Finalize(IntPtr data)
        {
            Measure measure = (Measure)data;
            measure.Dispose();
            GCHandle.FromIntPtr(data).Free();
        }

        [DllExport]
        public static void Reload(IntPtr data, IntPtr rm, ref double maxValue)
        {
            Measure measure = (Measure)data;
            measure.Reload(new Rainmeter.API(rm), ref maxValue);
        }

        [DllExport]
        public static double Update(IntPtr data)
        {
            Measure measure = (Measure)data;
            return measure.Update();
        }

        [DllExport]
        public static IntPtr GetString(IntPtr data)
        {
            Measure measure = (Measure)data;
            return Rainmeter.StringBuffer.Update(measure.GetStringValue());
        }

        // Section variable: [WebSocketMeasure:Perk(1)] .. [WebSocketMeasure:Perk(4)]
        [DllExport]
        public static IntPtr Perk(IntPtr data, int argc, string[] argv)
        {
            Measure measure = (Measure)data;
            int index = 0;
            if (argc >= 1)
            {
                int.TryParse(argv[0], out index);
            }
            return Rainmeter.StringBuffer.Update(measure.GetPerk(index));
        }
    }
}