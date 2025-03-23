import { IsString } from 'class-validator';
import {
  BaseCategoryCreateDto,
  BaseCategoryUpdateDto,
  BaseCategoryGetDto,
} from './base-category.dto';

export class CreateCategoryDto extends BaseCategoryCreateDto {
  @IsString()
  shopId: string;
}

export class UpdateCategoryDto extends BaseCategoryUpdateDto {}

export class GetCategoriesDto extends BaseCategoryGetDto {
  @IsString()
  shopId: string;
}
