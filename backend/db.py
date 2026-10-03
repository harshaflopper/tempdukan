import httpx
from typing import Dict, Any, List, Optional
from config import settings

class TableClient:
    def __init__(self, base_url: str, headers: dict, table_name: str):
        self.base_url = base_url
        self.headers = headers
        self.table_name = table_name
        self.query_params = []
        self.action = "GET"
        self.payload = None

    def select(self, columns: str = "*"):
        self.action = "GET"
        self.query_params.append(f"select={columns}")
        return self

    def eq(self, column: str, value: Any):
        self.query_params.append(f"{column}=eq.{value}")
        return self

    def ilike(self, column: str, value: Any):
        self.query_params.append(f"{column}=ilike.{value}")
        return self

    def order(self, column: str, desc: bool = False):
        direction = "desc" if desc else "asc"
        self.query_params.append(f"order={column}.{direction}")
        return self

    def limit(self, count: int):
        self.query_params.append(f"limit={count}")
        return self

    def insert(self, record: dict):
        self.action = "POST"
        self.payload = record
        return self

    def update(self, payload: dict):
        self.action = "PATCH"
        self.payload = payload
        return self

    def delete(self):
        self.action = "DELETE"
        return self

    def execute(self):
        query_str = "&".join(self.query_params)
        url = f"{self.base_url}/rest/v1/{self.table_name}?{query_str}" if query_str else f"{self.base_url}/rest/v1/{self.table_name}"
        
        headers = {**self.headers}
        if self.action in ("POST", "PATCH"):
            headers["Prefer"] = "return=representation"

        try:
            with httpx.Client(timeout=10.0) as client:
                if self.action == "GET":
                    res = client.get(url, headers=headers)
                elif self.action == "POST":
                    res = client.post(url, json=self.payload, headers=headers)
                elif self.action == "PATCH":
                    res = client.patch(url, json=self.payload, headers=headers)
                elif self.action == "DELETE":
                    res = client.delete(url, headers=headers)
                
                if res.status_code in (200, 201):
                    data = res.json()
                    return ResponseData(data)
                print(f"Supabase {self.action} error {res.status_code}: {res.text}")
                return ResponseData([])
        except Exception as e:
            print(f"Supabase {self.action} exception: {e}")
            return ResponseData([])

class RPCClient:
    def __init__(self, base_url: str, headers: dict, function_name: str, payload: dict):
        self.url = f"{base_url}/rest/v1/rpc/{function_name}"
        self.headers = headers
        self.payload = payload

    def execute(self):
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.post(self.url, json=self.payload, headers=self.headers)
                if res.status_code == 200:
                    return ResponseData(res.json())
                return ResponseData([])
        except Exception as e:
            print(f"Supabase RPC exception: {e}")
            return ResponseData([])

class ResponseData:
    def __init__(self, data):
        self.data = data

class SupabaseRESTClient:
    def __init__(self, url: str, key: str):
        self.url = url.rstrip('/')
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }

    def table(self, table_name: str):
        return TableClient(self.url, self.headers, table_name)

    def rpc(self, function_name: str, payload: dict):
        return RPCClient(self.url, self.headers, function_name, payload)

_supabase_client = None

def get_supabase():
    global _supabase_client
    if _supabase_client is None:
        url = (settings.SUPABASE_URL or "").strip()
        key = (settings.SUPABASE_KEY or "").strip()
        
        if not url or not key or "YOUR_SUPABASE" in url or not (url.startswith("http://") or url.startswith("https://")):
            print("Notice: Supabase URL/Key missing or placeholder. Running in fallback mode.")
            return None

        try:
            _supabase_client = SupabaseRESTClient(url, key)
            print("Successfully connected to Supabase PostgreSQL database via Direct REST API!")
        except Exception as e:
            print(f"Warning: Failed to connect to Supabase REST client ({e}).")
            return None

    return _supabase_client
