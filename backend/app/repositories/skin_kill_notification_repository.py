from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models import SkinKillNotification, HeroSkin, Hero


class SkinKillNotificationRepository:
    def __init__(self, db: Session):
        self.db = db

    def list(
        self,
        keyword: Optional[str] = None,
        hero_id: Optional[UUID] = None,
        skin_id: Optional[UUID] = None,
        status: Optional[str] = None,
    ) -> list[SkinKillNotification]:
        query = self.db.query(SkinKillNotification).join(SkinKillNotification.skin).join(HeroSkin.hero)

        if keyword:
            query = query.filter(SkinKillNotification.name.ilike(f"%{keyword}%"))
        if skin_id:
            query = query.filter(SkinKillNotification.skin_id == skin_id)
        if hero_id:
            query = query.filter(HeroSkin.hero_id == hero_id)
        if status:
            query = query.filter(SkinKillNotification.status == status)

        return query.order_by(Hero.name.asc(), HeroSkin.name.asc(), SkinKillNotification.sort_order.asc()).all()

    def get_by_id(self, ntf_id: UUID) -> Optional[SkinKillNotification]:
        return self.db.query(SkinKillNotification).filter(SkinKillNotification.id == ntf_id).first()

    def get_by_code(self, skin_id: UUID, code: str) -> Optional[SkinKillNotification]:
        return self.db.query(SkinKillNotification).filter(
            SkinKillNotification.skin_id == skin_id, SkinKillNotification.code == code
        ).first()

    def create(self, obj: SkinKillNotification) -> SkinKillNotification:
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def update(self, obj: SkinKillNotification) -> SkinKillNotification:
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def delete(self, obj: SkinKillNotification) -> None:
        self.db.delete(obj)
        self.db.commit()
