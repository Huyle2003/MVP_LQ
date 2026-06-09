import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.database import Base
from app.utils.slug import to_slug


def _utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(500), nullable=False)
    role = Column(String(20), nullable=False, default="USER")
    status = Column(String(20), nullable=False, default="ACTIVE")
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    __table_args__ = (
        CheckConstraint("role IN ('ADMIN', 'USER')", name="ck_user_role"),
        CheckConstraint("status IN ('ACTIVE', 'INACTIVE', 'LOCKED')", name="ck_user_status"),
        CheckConstraint("email <> ''", name="ck_user_email_not_empty"),
    )

    def __repr__(self):
        return f"<User {self.email}>"


class Hero(Base):
    __tablename__ = "heroes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, unique=True, index=True)
    code = Column(String(255), nullable=False, unique=True, index=True)
    avatar_object_name = Column(String(500), nullable=True, default=None)
    status = Column(String(20), nullable=False, default="ACTIVE")
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    skins = relationship("HeroSkin", back_populates="hero", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("status IN ('ACTIVE', 'INACTIVE')", name="ck_hero_status"),
        CheckConstraint("name <> ''", name="ck_hero_name_not_empty"),
    )

    def __repr__(self):
        return f"<Hero {self.name}>"


class HeroSkin(Base):
    __tablename__ = "hero_skins"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hero_id = Column(
        UUID(as_uuid=True),
        ForeignKey("heroes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    skin_code = Column(String(255), nullable=False)
    image_object_name = Column(String(500), nullable=False)
    preview_object_name = Column(String(500), nullable=True, default=None)
    status = Column(String(20), nullable=False, default="ACTIVE")
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    hero = relationship("Hero", back_populates="skins")

    __table_args__ = (
        UniqueConstraint("hero_id", "skin_code", name="uq_hero_skin_code"),
        CheckConstraint("status IN ('ACTIVE', 'INACTIVE')", name="ck_skin_status"),
        CheckConstraint("name <> ''", name="ck_skin_name_not_empty"),
        CheckConstraint("image_object_name <> ''", name="ck_skin_image_not_empty"),
    )

    buttons = relationship("SkinButton", back_populates="skin", cascade="all, delete-orphan")
    kill_notifications = relationship("SkinKillNotification", back_populates="skin", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<HeroSkin {self.name} (hero={self.hero_id})>"


class SkinButton(Base):
    __tablename__ = "skin_buttons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    skin_id = Column(
        UUID(as_uuid=True),
        ForeignKey("hero_skins.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    code = Column(String(255), nullable=False)
    image_object_name = Column(String(500), nullable=False)
    status = Column(String(20), nullable=False, default="ACTIVE")
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    skin = relationship("HeroSkin", back_populates="buttons")

    __table_args__ = (
        UniqueConstraint("skin_id", "code", name="uq_skin_button_code"),
        CheckConstraint("status IN ('ACTIVE', 'INACTIVE')", name="ck_button_status"),
        CheckConstraint("name <> ''", name="ck_button_name_not_empty"),
        CheckConstraint("image_object_name <> ''", name="ck_button_image_not_empty"),
    )

    def __repr__(self):
        return f"<SkinButton {self.name}>"


class SkinKillNotification(Base):
    __tablename__ = "skin_kill_notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    skin_id = Column(
        UUID(as_uuid=True),
        ForeignKey("hero_skins.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name = Column(String(255), nullable=False)
    code = Column(String(255), nullable=False)
    image_object_name = Column(String(500), nullable=False)
    status = Column(String(20), nullable=False, default="ACTIVE")
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    skin = relationship("HeroSkin", back_populates="kill_notifications")

    __table_args__ = (
        UniqueConstraint("skin_id", "code", name="uq_skin_kill_notify_code"),
        CheckConstraint("status IN ('ACTIVE', 'INACTIVE')", name="ck_notify_status"),
        CheckConstraint("name <> ''", name="ck_notify_name_not_empty"),
        CheckConstraint("image_object_name <> ''", name="ck_notify_image_not_empty"),
    )

    def __repr__(self):
        return f"<SkinKillNotification {self.name}>"


class OtherImage(Base):
    __tablename__ = "other_images"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    code = Column(String(255), nullable=False, unique=True, index=True)
    image_object_name = Column(String(500), nullable=False)
    status = Column(String(20), nullable=False, default="ACTIVE")
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    __table_args__ = (
        CheckConstraint("status IN ('ACTIVE', 'INACTIVE')", name="ck_other_image_status"),
        CheckConstraint("name <> ''", name="ck_other_image_name_not_empty"),
        CheckConstraint("image_object_name <> ''", name="ck_other_image_object_not_empty"),
    )

    def __repr__(self):
        return f"<OtherImage {self.name}>"


class CountedImage(Base):
    __tablename__ = "counted_images"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    code = Column(String(255), nullable=False, unique=True, index=True)
    image_object_name = Column(String(500), nullable=False)
    default_quantity = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default="ACTIVE")
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    __table_args__ = (
        CheckConstraint("status IN ('ACTIVE', 'INACTIVE')", name="ck_counted_image_status"),
        CheckConstraint("name <> ''", name="ck_counted_image_name_not_empty"),
        CheckConstraint("image_object_name <> ''", name="ck_counted_image_object_not_empty"),
        CheckConstraint("default_quantity >= 0", name="ck_counted_image_quantity"),
    )

    def __repr__(self):
        return f"<CountedImage {self.name}>"
