
from typing import List
from fastapi import APIRouter, Query, HTTPException, Depends
from datetime import datetime
from app.auth.session import get_current_user 
from app.models.trigger import UniversalTrigger
from app.services.triggers import register_trigger_db, get_triggers_by_user, delete_trigger_db
from app.services.candle_watcher import ensure_subscription, maybe_unsubscribe
from datetime import timezone

router = APIRouter()

@router.post("/triggers")
async def create_trigger(trigger: UniversalTrigger, current_user=Depends(get_current_user)):
    try:
        trigger.registered_at = datetime.now(timezone.utc)
        saved = register_trigger_db(trigger, current_user["user_id"])  # inject user_id securely
        await ensure_subscription(trigger.condition.symbol, trigger.condition.interval)
        return {"status": "ok", "trigger": saved}
    except Exception as exc:
        # Surface detailed DB or validation errors to the client during hackathon
        raise HTTPException(status_code=500, detail=str(exc))

@router.get("/triggers", response_model=List[UniversalTrigger])
async def get_triggers(userId: int = Query(...)):
    return get_triggers_by_user(userId)

@router.delete("/triggers/{trigger_id}", status_code=204)
async def delete_trigger(trigger_id: int):
    try:
        # Delete and get the trigger for cleanup
        deleted_trigger = delete_trigger_db(trigger_id)
        
        # Check if websocket can be closed
        await maybe_unsubscribe(deleted_trigger.condition.symbol, deleted_trigger.condition.interval)
        
    except Exception as e:
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail="Trigger not found")
        raise HTTPException(status_code=500, detail=str(e))
