export interface CurrentUserInterface {
  id: string;
  email: string;
  token: string;
  username: string;
  bio: string | null;
  image: string | null;
  name?: string | null;
  address?: string | null;
  cel?: string | null;
  tel?: string | null;
  contacts?: any;
  type?: string | null;
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}
