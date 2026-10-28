import sys
import os

# Include SuperMusicPro backend handler
sys.path.insert(0, r"C:\Users\lucab\Projects\SuperMusicPro")
from server import SuperMusicAPIHandler, ThreadingHTTPServer

def run(port=4545):
    # Bind to 0.0.0.0 so all devices on Wi-Fi and Android can access the stream server
    server = ThreadingHTTPServer(('0.0.0.0', port), SuperMusicAPIHandler)
    print(f"[SuperMusicPro-Android Server] Running on http://0.0.0.0:{port} (Wi-Fi IP: 192.168.1.33:{port})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[SuperMusicPro-Android Server] Stopped.")

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 4545
    run(port)
