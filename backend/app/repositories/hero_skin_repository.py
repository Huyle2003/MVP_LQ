from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.db.models import HeroSkin


class HeroSkinRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_by_hero(self, hero_id: UUID) -> list[HeroSkin]:
        return (
            self.db.query(HeroSkin)
            .filter(HeroSkin.hero_id == hero_id)
            .order_by(HeroSkin.sort_order.asc())
            .all()
        )

    def get_by_id(self, skin_id: UUID) -> Optional[HeroSkin]:
        return self.db.query(HeroSkin).filter(HeroSkin.id == skin_id).first()

    def get_by_skin_code(self, hero_id: UUID, skin_code: str) -> Optional[HeroSkin]:
        return (
            self.db.query(HeroSkin)
            .filter(HeroSkin.hero_id == hero_id, HeroSkin.skin_code == skin_code)
            .first()
        )

    def create(self, skin: HeroSkin) -> HeroSkin:
        self.db.add(skin)
        self.db.commit()
        self.db.refresh(skin)
        return skin

    def update(self, skin: HeroSkin) -> HeroSkin:
        self.db.commit()
        self.db.refresh(skin)
        return skin

    def delete(self, skin: HeroSkin) -> None:
        self.db.delete(skin)
        self.db.commit()
