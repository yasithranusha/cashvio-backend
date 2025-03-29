export enum S3_FOLDERS {
  IMAGES = 'images',
  DOCUMENTS = 'documents',
  AVATARS = 'avatars',
  PRODUCTS = 'products',
  CATEGORIES = 'categories',
}

export type S3FolderType = keyof typeof S3_FOLDERS | string;
