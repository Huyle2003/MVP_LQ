from typing import Optional
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.db.models import SkinButton, HeroSkin, Hero


class SkinButtonRepository:
    def __init__(self, db: Session):
        self.db = db

    def list(
        self,
        keyword: Optional[str] = None,
        hero_id: Optional[UUID] = None,
        skin_id: Optional[UUID] = None,
        status: Optional[str] = None,
    ) -> list[SkinButton]:
        query = self.db.query(SkinButton).join(SkinButton.skin).join(HeroSkin.hero)

        if keyword:
            query = query.filter(SkinButton.name.ilike(f"%{keyword}%"))
        if skin_id:
            query = query.filter(SkinButton.skin_id == skin_id)
        if hero_id:
            query = query.filter(HeroSkin.hero_id == hero_id)
        if status:
            query = query.filter(SkinButton.status == status)

        return query.order_by(Hero.name.asc(), HeroSkin.name.asc(), SkinButton.sort_order.asc()).all()

    def get_by_id(self, button_id: UUID) -> Optional[SkinButton]:
        return self.db.query(SkinButton).filter(SkinButton.id == button_id).first()

    def get_by_code(self, skin_id: UUID, code: str) -> Optional[SkinButton]:
        return self.db.query(SkinButton).filter(
            SkinButton.skin_id == skin_id, SkinButton.code == code
        ).first()

    def create(self, obj: SkinButton) -> SkinButton:
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def update(self, obj: SkinButton) -> SkinButton:
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def delete(self, obj: SkinButton) -> None:
        self.db.delete(obj)
        self.db.commit()
