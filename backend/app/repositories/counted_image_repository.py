from typing import Optional
from uuid import UUID

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.models import CountedImage


class CountedImageRepository:
    def __init__(self, db: Session):
        self.db = db

    def list(self, keyword: Optional[str] = None, status: Optional[str] = None) -> list[CountedImage]:
        query = self.db.query(CountedImage)

        if keyword:
            like = f"%{keyword}%"
            query = query.filter(
                or_(CountedImage.name.ilike(like), CountedImage.code.ilike(like))
            )

        if status:
            query = query.filter(CountedImage.status == status)

        return query.order_by(CountedImage.sort_order, CountedImage.created_at.desc()).all()

    def get_by_id(self, item_id: UUID) -> Optional[CountedImage]:
        return self.db.query(CountedImage).filter(CountedImage.id == item_id).first()

    def get_by_code(self, code: str) -> Optional[CountedImage]:
        return self.db.query(CountedImage).filter(CountedImage.code == code).first()

    def create(self, item: CountedImage) -> CountedImage:
        self.db.add(item)
        self.db.commit()
        self.db.refresh(item)
        return item

    def update(self, item: CountedImage) -> CountedImage:
        self.db.commit()
        self.db.refresh(item)
        return item

    def delete(self, item: CountedImage) -> None:
        self.db.delete(item)
        self.db.commit()
