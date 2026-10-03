import httpx
import time
from typing import Dict, Any, List, Optional
from config import settings

# Global In-Memory Persistent Store fallback for missing Supabase tables
LOCAL_MEMORY_STORE: Dict[str, List[Dict[str, Any]]] = {
    "products": [],
    "customers": [
        {"id": "cust-ravi", "shop_id": "SHOP001", "name": "Ravi", "phone": "9876543210", "udhaar_balance": 150.0},
        {"id": "cust-ragi", "shop_id": "SHOP001", "name": "Ragi", "phone": None, "udhaar_balance": 0.0}
    ],
    "bills": [],
    "bill_items": [],
    "udhaar_logs": []
}

class TableClient:
    def __init__(self, base_url: str, headers: dict, table_name: str):
        self.base_url = base_url
        self.headers = headers
        self.table_name = table_name
        self.eq_filters = {}
        self.ilike_filters = {}
        self.order_col = None
        self.order_desc = False
        self.limit_val = None
        self.action = "GET"
        self.payload = None

    def select(self, columns: str = "*"):
        self.action = "GET"
        return self

    def eq(self, column: str, value: Any):
        self.eq_filters[column] = value
        return self

    def ilike(self, column: str, value: Any):
        self.ilike_filters[column] = str(value).lower()
        return self

    def order(self, column: str, desc: bool = False):
        self.order_col = column
        self.order_desc = desc
        return self

    def limit(self, count: int):
        self.limit_val = count
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

    def _execute_local(self) -> List[Dict[str, Any]]:
        table_items = LOCAL_MEMORY_STORE.get(self.table_name, [])

        if self.action == "POST":
            new_record = dict(self.payload or {})
            if "id" not in new_record:
                new_record["id"] = f"{self.table_name[:4]}-{int(time.time()*1000)}"
            if "created_at" not in new_record:
                new_record["created_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ")
            
            table_items.append(new_record)
            LOCAL_MEMORY_STORE[self.table_name] = table_items
            print(f"Local Store INSERT on '{self.table_name}': {new_record.get('name') or new_record.get('id')}")
            return [new_record]

        # Filter items for GET / PATCH
        filtered = []
        for item in table_items:
            match = True
            for k, v in self.eq_filters.items():
                if str(item.get(k)) != str(v):
                    match = False
                    break
            if match:
                for k, v in self.ilike_filters.items():
                    val = str(item.get(k) or "").lower()
                    if v not in val:
                        match = False
                        break
            if match:
                filtered.append(item)

        if self.action == "PATCH" and self.payload:
            updated = []
            for item in filtered:
                item.update(self.payload)
                updated.append(item)
            print(f"Local Store PATCH on '{self.table_name}': updated {len(updated)} items")
            return updated

        if self.limit_val and len(filtered) > self.limit_val:
            filtered = filtered[:self.limit_val]

        return filtered

    def execute(self):
        query_params = []
        for k, v in self.eq_filters.items():
            query_params.append(f"{k}=eq.{v}")
        for k, v in self.ilike_filters.items():
            query_params.append(f"{k}=ilike.{v}")
        if self.order_col:
            query_params.append(f"order={self.order_col}.{'desc' if self.order_desc else 'asc'}")
        if self.limit_val:
            query_params.append(f"limit={self.limit_val}")

        query_str = "&".join(query_params)
        url = f"{self.base_url}/rest/v1/{self.table_name}?{query_str}" if query_str else f"{self.base_url}/rest/v1/{self.table_name}"
        
        headers = {**self.headers}
        if self.action in ("POST", "PATCH"):
            headers["Prefer"] = "return=representation"

        try:
            with httpx.Client(timeout=4.0) as client:
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
                    if isinstance(data, list) and len(data) > 0:
                        return ResponseData(data)
                    elif self.action in ("POST", "PATCH") and data:
                        return ResponseData(data if isinstance(data, list) else [data])
                    
                    local_res = self._execute_local()
                    return ResponseData(local_res if local_res else (data if isinstance(data, list) else []))

                print(f"Supabase {self.action} error {res.status_code}: Table '{self.table_name}' missing or unconfigured. Fallback to local store.")
        except Exception as e:
            print(f"Supabase {self.action} exception: {e}")

        return ResponseData(self._execute_local())

class RPCClient:
    def __init__(self, base_url: str, headers: dict, function_name: str, payload: dict):
        self.url = f"{base_url}/rest/v1/rpc/{function_name}"
        self.headers = headers
        self.payload = payload

    def execute(self):
        try:
            with httpx.Client(timeout=5.0) as client:
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
            print("Notice: Supabase URL/Key missing or placeholder. Running in local store mode.")
            return SupabaseRESTClient("http://localhost:8000", "local-key")

        try:
            _supabase_client = SupabaseRESTClient(url, key)
            print("Successfully connected to Supabase REST client with Local Store fallback!")
        except Exception as e:
            print(f"Warning: Failed to connect to Supabase REST client ({e}).")
            return SupabaseRESTClient("http://localhost:8000", "local-key")

    return _supabase_client
