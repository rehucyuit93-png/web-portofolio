export type UserRole = 'admin' | 'guru' | 'siswa';

export type FileTypeTag = 'PDF' | 'DOCX' | 'PPT' | 'XLSX' | 'JPG' | 'PNG';

export type AchievementLevel =
  | 'Sekolah'
  | 'Kabupaten/Kota'
  | 'Provinsi'
  | 'Nasional'
  | 'Internasional';

export type LogAction =
  | 'LOGIN'
  | 'UPLOAD_FILE'
  | 'EDIT_DATA'
  | 'DELETE_DATA'
  | 'ADMIN_ACTION'
  | 'PUBLISH_PORTFOLIO';

export type DashboardSection =
  | 'dashboard'
  | 'profile'
  | 'documents'
  | 'certificates'
  | 'achievements'
  | 'activities'
  | 'gallery'
  | 'cv'
  | 'logs'
  | 'settings'
  | 'admin'
  | 'public_preview';

export interface UserAccount {
  id?: string;
  uid: string;
  username: string;
  email: string;
  displayName: string;
  role: UserRole;
  nipNisn?: string;
  jabatanKelas?: string;
  photoURL?: string;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserProfile {
  id?: string;
  uid: string;
  username: string;
  fullName: string;
  nipNisn: string;
  jabatanKelas: string;
  birthPlace: string;
  birthDate: string;
  address: string;
  phone: string;
  email: string;
  education: string;
  expertise: string;
  bio: string;
  photoURL: string;
  isPublished: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PortfolioDocument {
  id: string;
  uid: string;
  title: string;
  category: string;
  year: number;
  description: string;
  fileName: string;
  fileType: FileTypeTag;
  fileSize: number;
  fileUrl: string;
  storagePath?: string;
  isPublic: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Certificate {
  id: string;
  uid: string;
  eventName: string;
  organizer: string;
  year: number;
  description: string;
  fileName?: string;
  fileUrl: string;
  storagePath?: string;
  isPublic: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Achievement {
  id: string;
  uid: string;
  title: string;
  level: AchievementLevel;
  year: number;
  description: string;
  photoUrl?: string;
  storagePath?: string;
  isPublic: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Activity {
  id: string;
  uid: string;
  title: string;
  date: string;
  year: number;
  description: string;
  photoUrl?: string;
  storagePath?: string;
  isPublic: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface GalleryItem {
  id: string;
  uid: string;
  title: string;
  album: string;
  year: number;
  caption: string;
  imageUrl: string;
  storagePath?: string;
  isPublic: boolean;
  createdAt?: unknown;
}

export interface AuditLog {
  id: string;
  uid: string;
  userEmail?: string;
  userName?: string;
  action: LogAction;
  module: string;
  detail: string;
  createdAt?: unknown;
}

export interface UserSettings {
  uid: string;
  theme: 'light' | 'dark';
  emailNotifications: boolean;
  activityAlerts: boolean;
  publicPortfolioEnabled: boolean;
  cvTemplate: 'modern' | 'ats';
  updatedAt?: unknown;
}

export interface PublicPortfolioDoc {
  uid: string;
  username: string;
  fullName: string;
  role?: UserRole;
  nipNisn?: string;
  jabatanKelas?: string;
  education?: string;
  expertise?: string;
  bio?: string;
  photoURL?: string;
  isPublished: boolean;
  featuredDocuments?: Array<{
    id: string;
    title: string;
    category: string;
    year: number;
    fileType: string;
    fileUrl: string;
    description?: string;
  }>;
  featuredCertificates?: Array<{
    id: string;
    eventName: string;
    organizer: string;
    year: number;
    fileUrl: string;
    description?: string;
  }>;
  featuredAchievements?: Array<{
    id: string;
    title: string;
    level: string;
    year: number;
    photoUrl?: string;
    description?: string;
  }>;
  featuredGalleries?: Array<{
    id: string;
    title: string;
    album: string;
    year: number;
    imageUrl: string;
    caption?: string;
  }>;
  updatedAt?: unknown;
}
