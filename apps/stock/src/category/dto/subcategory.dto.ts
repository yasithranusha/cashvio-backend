import { IsOptional, IsString } from 'class-validator';
import {
  BaseCategoryCreateDto,
  BaseCategoryUpdateDto,
  BaseCategoryGetDto,
} from './base-category.dto';

export class CreateSubCategoryDto extends BaseCategoryCreateDto {
  @IsString()
  categoryId: string;
}

export class UpdateSubCategoryDto extends BaseCategoryUpdateDto {
  @IsOptional()
  @IsString()
  categoryId?: string;
}

export class GetShopSubCategoriesDto extends BaseCategoryGetDto {
  @IsString()
  shopId: string;

  @IsOptional()
  @IsString()
  categoryId?: string;
}
