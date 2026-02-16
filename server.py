import http.server
import socketserver
import os
import sys

# Add project directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import the processing script
# Import the processing script
from utils import process_leaderboards

PORT = 8000

class AutoProcessHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # We want to refresh the data when the frontend requests the leaderboards.
        # The frontend fetches "/data/leaderboard.json".
        if self.path.endswith('/data/leaderboard.json'):
            print("Regenerating leaderboard data...")
            try:
                # Run the main function from process_leaderboards
                process_leaderboards.main()
            except Exception as e:
                print(f"Error regenerating leaderboard: {e}")
        
        return super().do_GET()

def main():
    # Ensure we are serving from the project root
    project_root = os.path.dirname(os.path.abspath(__file__))
    os.chdir(project_root)
    
    # Run initial processing once on startup
    print("Running initial leaderboard processing...")
    try:
        process_leaderboards.main()
    except Exception as e:
        print(f"Initial processing failed: {e}")

    # Set up the server
    handler = AutoProcessHandler
    
    # Allow address reuse to avoid "Address already in use" errors during quick restarts
    socketserver.TCPServer.allow_reuse_address = True
    
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print(f"\nServing at http://localhost:{PORT}")
        print("Leaderboard data will be automatically regenerated when requested.")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")
            httpd.shutdown()

if __name__ == "__main__":
    main()
