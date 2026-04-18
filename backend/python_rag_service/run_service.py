import os
import socket
import threading
from urllib.request import urlopen
from urllib.error import URLError

import uvicorn


def _is_port_open(host: str, port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(1)
        return sock.connect_ex((host, port)) == 0


def _health_ok(url: str) -> bool:
    try:
        with urlopen(url, timeout=2) as res:
            return res.status == 200
    except URLError:
        return False
    except Exception:
        return False


def main() -> None:
    host = os.getenv("RAG_HOST", "0.0.0.0")
    port = int(os.getenv("RAG_PORT", "8001"))
    health_url = f"http://127.0.0.1:{port}/health"

    if _is_port_open("127.0.0.1", port):
        if _health_ok(health_url):
            print(f"[RAG] Existing service already running on {port}. Reusing it.")
            # Keep process alive so root concurrently does not terminate other services.
            threading.Event().wait()
            return
        raise RuntimeError(f"Port {port} is in use by a non-RAG process")

    uvicorn.run("python_rag_service.app:app", host=host, port=port, reload=False)


if __name__ == "__main__":
    main()
