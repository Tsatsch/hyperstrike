from typing import List, Optional
from app.db.sb import supabase
from app.models.hypercore import (
    UserSubaccount, UserSubaccountCreate, UserSubaccountUpdate,
    PreTriggerOrder, PreTriggerOrderCreate,
    PostTriggerPosition, PostTriggerPositionCreate, PostTriggerPositionUpdate
)
import logging

logger = logging.getLogger(__name__)


class HypercoreService:
    """Service for managing hypercore database operations"""

    @staticmethod
    async def create_user_subaccount(subaccount: UserSubaccountCreate) -> Optional[UserSubaccount]:
        """Create a new user subaccount"""
        try:
            if not supabase:
                logger.error("Supabase client not initialized")
                return None
            
            data = subaccount.model_dump()
            data['timestamp_creation'] = data.get('timestamp_creation') or 'now()'
            
            result = supabase.table('user_subaccounts').insert(data).execute()
            
            if result.data:
                return UserSubaccount(**result.data[0])
            return None
        except Exception as e:
            logger.error(f"Error creating user subaccount: {e}")
            return None

    @staticmethod
    async def get_user_subaccounts(user_id: int, active_only: bool = True) -> List[UserSubaccount]:
        """Get user subaccounts, optionally filtering by active status"""
        try:
            if not supabase:
                logger.error("Supabase client not initialized")
                return []
            
            query = supabase.table('user_subaccounts').select('*').eq('user_id', user_id)
            
            if active_only:
                query = query.eq('is_active', True)
            
            result = query.execute()
            
            if result.data:
                return [UserSubaccount(**item) for item in result.data]
            return []
        except Exception as e:
            logger.error(f"Error fetching user subaccounts: {e}")
            return []

    @staticmethod
    async def get_user_subaccount_by_wallet(user_wallet: str, active_only: bool = True) -> Optional[UserSubaccount]:
        """Get user subaccount by wallet address"""
        try:
            if not supabase:
                logger.error("Supabase client not initialized")
                return None
            
            query = supabase.table('user_subaccounts').select('*').eq('user_wallet', user_wallet)
            
            if active_only:
                query = query.eq('is_active', True)
            
            result = query.execute()
            
            if result.data:
                return UserSubaccount(**result.data[0])
            return None
        except Exception as e:
            logger.error(f"Error fetching user subaccount by wallet: {e}")
            return None

    @staticmethod
    async def update_user_subaccount(subaccount_id: int, updates: UserSubaccountUpdate) -> Optional[UserSubaccount]:
        """Update user subaccount"""
        try:
            if not supabase:
                logger.error("Supabase client not initialized")
                return None
            
            data = updates.model_dump(exclude_unset=True)
            result = supabase.table('user_subaccounts').update(data).eq('id', subaccount_id).execute()
            
            if result.data:
                return UserSubaccount(**result.data[0])
            return None
        except Exception as e:
            logger.error(f"Error updating user subaccount: {e}")
            return None

    @staticmethod
    async def create_pre_trigger_order(order: PreTriggerOrderCreate) -> Optional[PreTriggerOrder]:
        """Create a new pre-trigger order"""
        try:
            if not supabase:
                logger.error("Supabase client not initialized")
                return None
            
            data = order.model_dump()
            result = supabase.table('pre_trigger_orders').insert(data).execute()
            
            if result.data:
                return PreTriggerOrder(**result.data[0])
            return None
        except Exception as e:
            logger.error(f"Error creating pre-trigger order: {e}")
            return None

    @staticmethod
    async def get_pre_trigger_orders(user_id: int) -> List[PreTriggerOrder]:
        """Get pre-trigger orders for a user"""
        try:
            if not supabase:
                logger.error("Supabase client not initialized")
                return []
            
            result = supabase.table('pre_trigger_orders').select('*').eq('user_id', user_id).execute()
            
            if result.data:
                return [PreTriggerOrder(**item) for item in result.data]
            return []
        except Exception as e:
            logger.error(f"Error fetching pre-trigger orders: {e}")
            return []

    @staticmethod
    async def delete_pre_trigger_order(order_id: int) -> bool:
        """Delete a pre-trigger order"""
        try:
            if not supabase:
                logger.error("Supabase client not initialized")
                return False
            
            result = supabase.table('pre_trigger_orders').delete().eq('id', order_id).execute()
            return bool(result.data)
        except Exception as e:
            logger.error(f"Error deleting pre-trigger order: {e}")
            return False

    @staticmethod
    async def create_post_trigger_position(position: PostTriggerPositionCreate) -> Optional[PostTriggerPosition]:
        """Create a new post-trigger position"""
        try:
            if not supabase:
                logger.error("Supabase client not initialized")
                return None
            
            data = position.model_dump()
            result = supabase.table('post_trigger_positions').insert(data).execute()
            
            if result.data:
                return PostTriggerPosition(**result.data[0])
            return None
        except Exception as e:
            logger.error(f"Error creating post-trigger position: {e}")
            return None

    @staticmethod
    async def get_post_trigger_positions(user_id: int, active_only: bool = True) -> List[PostTriggerPosition]:
        """Get post-trigger positions for a user"""
        try:
            if not supabase:
                logger.error("Supabase client not initialized")
                return []
            
            query = supabase.table('post_trigger_positions').select('*').eq('user_id', user_id)
            
            if active_only:
                query = query.eq('is_active', True)
            
            result = query.execute()
            
            if result.data:
                return [PostTriggerPosition(**item) for item in result.data]
            return []
        except Exception as e:
            logger.error(f"Error fetching post-trigger positions: {e}")
            return []

    @staticmethod
    async def update_post_trigger_position(position_id: int, updates: PostTriggerPositionUpdate) -> Optional[PostTriggerPosition]:
        """Update post-trigger position"""
        try:
            if not supabase:
                logger.error("Supabase client not initialized")
                return None
            
            data = updates.model_dump(exclude_unset=True)
            result = supabase.table('post_trigger_positions').update(data).eq('id', position_id).execute()
            
            if result.data:
                return PostTriggerPosition(**result.data[0])
            return None
        except Exception as e:
            logger.error(f"Error updating post-trigger position: {e}")
            return None

    @staticmethod
    async def get_user_credentials(user_id: int) -> Optional[UserSubaccount]:
        """Get user credentials, ignoring inactive entries if multiple exist"""
        try:
            if not supabase:
                logger.error("Supabase client not initialized")
                return None
            
            # Get all subaccounts for the user
            result = supabase.table('user_subaccounts').select('*').eq('user_id', user_id).execute()
            
            if not result.data:
                return None
            
            # If only one entry, return it regardless of active status
            if len(result.data) == 1:
                return UserSubaccount(**result.data[0])
            
            # If multiple entries, filter by active status
            active_subaccounts = [item for item in result.data if item.get('is_active', True)]
            
            if active_subaccounts:
                # Return the first active subaccount
                return UserSubaccount(**active_subaccounts[0])
            
            # If no active subaccounts, return None
            return None
            
        except Exception as e:
            logger.error(f"Error fetching user credentials: {e}")
            return None
