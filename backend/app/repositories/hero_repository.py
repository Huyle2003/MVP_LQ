from typing import Optional
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.models import Hero, HeroSkin


class HeroRepository:
    def __init__(self, db: Session):
        self.db = db

    def list_heroes(
        self,
        keyword: Optional[str] = None,
        status: Optional[str] = None,
    ) -> list[Hero]:
        query = self.db.query(Hero)

        if keyword:
            query = query.filter(
                Hero.name.ilike(f"%{keyword}%") | Hero.code.ilike(f"%{keyword}%")
            )

        if status:
            query = query.filter(Hero.status == status)

        return query.order_by(Hero.name.asc()).all()

    def get_by_id(self, hero_id: UUID) -> Optional[Hero]:
        return self.db.query(Hero).filter(Hero.id == hero_id).first()

    def get_by_name(self, name: str) -> Optional[Hero]:
        return self.db.query(Hero).filter(Hero.name == name).first()

    def get_by_code(self, code: str) -> Optional[Hero]:
        return self.db.query(Hero).filter(Hero.code == code).first()

    def create(self, hero: Hero) -> Hero:
        self.db.add(hero)
        self.db.commit()
        self.db.refresh(hero)
        return hero

    def update(self, hero: Hero) -> Hero:
        self.db.commit()
        self.db.refresh(hero)
        return hero

    def delete(self, hero: Hero) -> None:
        self.db.delete(hero)
        self.db.commit()

    def count_skins(self, hero_id: UUID) -> int:
        return (
            self.db.query(func.count(HeroSkin.id))
            .filter(HeroSkin.hero_id == hero_id)
            .scalar()
            or 0
        )
