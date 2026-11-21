import http.server
import socketserver
import os
import sys

# Add project directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import the processing script
from utils import process_elo

PORT = 8000

class StaticHandler(http.server.SimpleHTTPRequestHandler):
    """Serves static files after refreshing the tournament results at startup."""
    
    def do_GET(self):
        if self.path == '/':
            self.send_response(301)
            self.send_header('Location', '/index.html')
            self.end_headers()
            return
        elif self.path.startswith('/docs/'):
            self.send_response(301)
            self.send_header('Location', self.path[len('/docs'):])
            self.end_headers()
            return

        super().do_GET()

def main():
    project_root = os.path.dirname(os.path.abspath(__file__))
    docs_dir = os.path.join(project_root, 'docs')
    os.chdir(docs_dir)

    print("Regenerating Elo ratings and head-to-head results...")
    try:
        process_elo.generate_leaderboard()
    except (OSError, ValueError) as error:
        print(f"Could not regenerate tournament results ({error}). Serving the saved export if available.")

    # Set up the server
    handler = StaticHandler

    # Allow address reuse to avoid "Address already in use" errors during quick restarts
    socketserver.TCPServer.allow_reuse_address = True

    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print(f"\nServing at http://localhost:{PORT}")
        print("Serving pre-computed static files.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
            httpd.shutdown()

if __name__ == "__main__":
    main()
