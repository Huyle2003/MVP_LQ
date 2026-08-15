export interface SelectedSkinItem {
  skinId: string;
  heroName: string;
  skinName: string;
  imagePath: string;
  availableButtons: { id: string; name: string; image_path: string }[];
  availableKillNotifications: { id: string; name: string; image_path: string }[];
  useButton: boolean;
  selectedButtonId: string | null;
  useKillNotification: boolean;
  selectedKillNotificationId: string | null;
}

export interface WinRateItem {
  id: string;
  imagePath: string;
  fileName: string;
}
