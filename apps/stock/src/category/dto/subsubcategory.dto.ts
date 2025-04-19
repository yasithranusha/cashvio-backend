import { IsOptional, IsString } from 'class-validator';
import {
  BaseCategoryCreateDto,
  BaseCategoryUpdateDto,
  BaseCategoryGetDto,
} from './base-category.dto';

export class CreateSubSubCategoryDto extends BaseCategoryCreateDto {
  @IsString()
  subCategoryId: string;
}

export class UpdateSubSubCategoryDto extends BaseCategoryUpdateDto {
  @IsString()
  subCategoryId: string;
}

export class GetShopSubSubCategoriesDto extends BaseCategoryGetDto {
  @IsString()
  shopId: string;

  @IsOptional()
  @IsString()
  subCategoryId?: string;
}
