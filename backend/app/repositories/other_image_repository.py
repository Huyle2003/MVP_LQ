from typing import Optional
from uuid import UUID

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.models import OtherImage


class OtherImageRepository:
    def __init__(self, db: Session):
        self.db = db

    def list(self, keyword: Optional[str] = None, status: Optional[str] = None) -> list[OtherImage]:
        query = self.db.query(OtherImage)

        if keyword:
            like = f"%{keyword}%"
            query = query.filter(
                or_(OtherImage.name.ilike(like), OtherImage.code.ilike(like))
            )

        if status:
            query = query.filter(OtherImage.status == status)

        return query.order_by(OtherImage.sort_order, OtherImage.created_at.desc()).all()

    def get_by_id(self, item_id: UUID) -> Optional[OtherImage]:
        return self.db.query(OtherImage).filter(OtherImage.id == item_id).first()

    def get_by_code(self, code: str) -> Optional[OtherImage]:
        return self.db.query(OtherImage).filter(OtherImage.code == code).first()

    def create(self, item: OtherImage) -> OtherImage:
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def update(self, item: OtherImage) -> OtherImage:
        self.db.commit()
        self.db.refresh(item)
        return item

    def delete(self, item: OtherImage) -> None:
        self.db.delete(item)
        self.db.commit()
