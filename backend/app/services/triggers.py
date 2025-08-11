from app.db.sb import supabase
from app.models.trigger import UniversalTrigger
from typing import List

def register_trigger_db(trigger: UniversalTrigger, user_id: int):
    # Exclude id so DB default can auto-increment; drop None values to avoid null violations
    data = trigger.model_dump(exclude={"user_id", "id"}, exclude_none=True)
    data["user_id"] = user_id  # authoritative
    if 'registered_at' in data and data['registered_at']:
        data['registered_at'] = data['registered_at'].isoformat()
    
    response = supabase.table("triggers").insert(data).execute()
    if response.error:
        raise Exception(f"Failed to register trigger: {response.error}")
    return UniversalTrigger(**response.data[0])

def get_triggers_by_user(user_id: int) -> List[UniversalTrigger]:
    response = supabase.table("triggers").select("*").eq("user_id", user_id).execute()
    if response.error:
        raise Exception(f"Failed to fetch triggers: {response.error}")
    return [UniversalTrigger(**t) for t in response.data]

def get_triggers_for(symbol: str, interval: str) -> List[UniversalTrigger]:
    """Get triggers for a specific symbol and interval"""
    response = supabase.table("triggers").select("*").eq("condition->>symbol", symbol).eq("condition->>interval", interval).execute()
    if response.error:
        raise Exception(f"Failed to fetch triggers: {response.error}")
    return [UniversalTrigger(**t) for t in response.data]

def delete_trigger_db(trigger_id: int) -> UniversalTrigger:
    """Delete trigger and return the deleted trigger for cleanup"""
    # First fetch the trigger to get symbol/interval for cleanup
    response = supabase.table("triggers").select("*").eq("id", trigger_id).execute()
    if response.error or not response.data:
        raise Exception(f"Trigger not found: {trigger_id}")
    
    trigger = UniversalTrigger(**response.data[0])
    
    # Now delete it
    delete_response = supabase.table("triggers").delete().eq("id", trigger_id).execute()
    if delete_response.error:
        raise Exception(f"Failed to delete trigger: {delete_response.error}")
    
    return trigger
