export interface User {
  id: string;
  username: string;
  email: string;
  kindle_email: string;
  permissions: string[];
}

export interface UserPermissions {
  admin: boolean;
  download: boolean;
  upload: boolean;
  edit: boolean;
  passwd: boolean;
  edit_shelfs: boolean;
  delete_books: boolean;
  viewer: boolean;
}

export interface UserDetails {
  id: string;
  username: string;
  email: string;
  kindle_email: string;
  locale: string;
  default_language: string;
  permissions: UserPermissions;
  csrf_token: string;
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
  kindle_email?: string;
  locale?: string;
  default_language?: string;
  permissions: UserPermissions;
}
