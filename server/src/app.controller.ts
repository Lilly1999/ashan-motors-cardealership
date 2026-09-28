import {
  Body,
  CanActivate,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  Header,
  HttpCode,
  Injectable,
  Param,
  Patch,
  Post,
  Req,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { AppService, UploadedPhoto } from './app.service';

class LoginDto {
  @IsString()
  @IsNotEmpty()
  password!: string;
}

class CarDto {
  @IsString() @IsNotEmpty() make!: string;
  @IsString() @IsNotEmpty() model!: string;
  @IsInt() @Min(1900) @Max(2100) year!: number;
  @IsNumber() @Min(0) price!: number;
  @IsNumber() @Min(0) mileage!: number;
  @IsString() @IsNotEmpty() transmission!: string;
  @IsString() @IsNotEmpty() fuel!: string;
  @IsString() @IsNotEmpty() body!: string;
  @IsOptional() @IsString() @MaxLength(30) engine?: string;
  @IsOptional() @IsString() @MaxLength(20) drive?: string;
  @IsOptional() @IsInt() @Min(1) @Max(80) seats?: number;
  @IsOptional() @IsString() @MaxLength(30) color?: string;
  @IsString() @IsNotEmpty() description!: string;
  @IsIn(['available', 'sold']) status!: 'available' | 'sold';
  @IsOptional() @IsBoolean() newArrival?: boolean;
  @IsString() @IsNotEmpty() collection!: string;
  // Full http(s) links, or site-relative links to uploaded photos.
  @IsArray() @Matches(/^(https?:\/\/\S+|\/(api\/photos|uploads)\/[\w.-]+)$/, { each: true, message: 'Each photo must be an uploaded photo or an http(s) link.' }) images!: string[];
}

class CollectionDto {
  @IsString() @IsNotEmpty() name!: string;
}

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly appService: AppService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string } }>();
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    return Boolean(token && this.appService.isValidToken(token));
  }
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth(): { status: string } {
    return { status: 'ok' };
  }

  @Post('auth/login')
  @HttpCode(200)
  login(@Body() body: LoginDto, @Req() request: { ip: string }): { token: string } {
    return { token: this.appService.login(body.password, request.ip) };
  }

  // Tokens are signed and expire on their own; signing out simply discards the token in the browser.
  @Post('auth/logout')
  @HttpCode(204)
  logout(): void {}

  @Get('cars')
  getCars() {
    return this.appService.getCars();
  }

  @Get('cars/:id')
  getCar(@Param('id') id: string) {
    return this.appService.getCar(id);
  }

  @Post('cars')
  @UseGuards(AdminGuard)
  createCar(@Body() body: CarDto) {
    return this.appService.createCar(body);
  }

  @Patch('cars/:id')
  @UseGuards(AdminGuard)
  updateCar(@Param('id') id: string, @Body() body: CarDto) {
    return this.appService.updateCar(id, body);
  }

  @Delete('cars/:id')
  @UseGuards(AdminGuard)
  deleteCar(@Param('id') id: string): Promise<void> {
    return this.appService.deleteCar(id);
  }

  @Post('uploads')
  @UseGuards(AdminGuard)
  // Vercel limits a request body to 4.5 MB, so the admin page uploads photos one at a time.
  @UseInterceptors(FilesInterceptor('photos', 12, { limits: { fileSize: 4 * 1024 * 1024 } }))
  async uploadPhotos(@UploadedFiles() files: UploadedPhoto[] | undefined): Promise<{ urls: string[] }> {
    return { urls: await this.appService.savePhotos(files ?? []) };
  }

  @Get('photos/:id')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  async getPhoto(@Param('id') id: string): Promise<StreamableFile> {
    const photo = await this.appService.getPhoto(id);
    return new StreamableFile(photo.data, { type: photo.mimetype, length: photo.data.length });
  }

  @Get('collections')
  getCollections() {
    return this.appService.getCollections();
  }

  @Post('collections')
  @UseGuards(AdminGuard)
  createCollection(@Body() body: CollectionDto) {
    return this.appService.createCollection(body.name);
  }

  @Delete('collections/:name')
  @UseGuards(AdminGuard)
  deleteCollection(@Param('name') name: string) {
    return this.appService.deleteCollection(name);
  }
}
