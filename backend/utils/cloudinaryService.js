const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Upload single image
const uploadImage = async (file, options = {}) => {
  try {
    const uploadOptions = {
      folder: options.folder || 'b2b-nexus',
      resource_type: 'image',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
      transformation: [
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ],
      ...options
    };

    // If file is a buffer (from multer)
    if (file.buffer) {
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        
        uploadStream.end(file.buffer);
      });
      
      return result;
    }

    // If file is a path
    if (file.path) {
      const result = await cloudinary.uploader.upload(file.path, uploadOptions);
      return result;
    }

    throw new Error('Invalid file format');
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw new Error('Failed to upload image');
  }
};

// Upload multiple images
const uploadMultipleImages = async (files, options = {}) => {
  try {
    const uploadPromises = files.map(file => uploadImage(file, options));
    const results = await Promise.all(uploadPromises);
    return results;
  } catch (error) {
    console.error('Multiple images upload error:', error);
    throw new Error('Failed to upload images');
  }
};

// Upload document
const uploadDocument = async (file, options = {}) => {
  try {
    const uploadOptions = {
      folder: options.folder || 'b2b-nexus/documents',
      resource_type: 'raw',
      allowed_formats: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'],
      ...options
    };

    if (file.buffer) {
      const result = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        
        uploadStream.end(file.buffer);
      });
      
      return result;
    }

    if (file.path) {
      const result = await cloudinary.uploader.upload(file.path, uploadOptions);
      return result;
    }

    throw new Error('Invalid file format');
  } catch (error) {
    console.error('Document upload error:', error);
    throw new Error('Failed to upload document');
  }
};

// Delete file from Cloudinary
const deleteFile = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw new Error('Failed to delete file');
  }
};

// Delete multiple files
const deleteMultipleFiles = async (publicIds, resourceType = 'image') => {
  try {
    const deletePromises = publicIds.map(publicId => deleteFile(publicId, resourceType));
    const results = await Promise.all(deletePromises);
    return results;
  } catch (error) {
    console.error('Multiple files delete error:', error);
    throw new Error('Failed to delete files');
  }
};

// Generate optimized image URL
const getOptimizedImageUrl = (publicId, options = {}) => {
  try {
    const defaultOptions = {
      quality: 'auto:good',
      fetch_format: 'auto',
      ...options
    };

    return cloudinary.url(publicId, defaultOptions);
  } catch (error) {
    console.error('Generate optimized URL error:', error);
    return null;
  }
};

// Generate thumbnail URL
const getThumbnailUrl = (publicId, width = 300, height = 300, options = {}) => {
  try {
    const thumbnailOptions = {
      width,
      height,
      crop: 'fill',
      quality: 'auto:good',
      fetch_format: 'auto',
      ...options
    };

    return cloudinary.url(publicId, thumbnailOptions);
  } catch (error) {
    console.error('Generate thumbnail URL error:', error);
    return null;
  }
};

// Generate responsive image URLs
const getResponsiveImageUrls = (publicId, breakpoints = [300, 600, 900, 1200]) => {
  try {
    const urls = {};
    
    breakpoints.forEach(width => {
      urls[width] = cloudinary.url(publicId, {
        width,
        crop: 'scale',
        quality: 'auto:good',
        fetch_format: 'auto'
      });
    });

    return urls;
  } catch (error) {
    console.error('Generate responsive URLs error:', error);
    return {};
  }
};

// Upload product images with different sizes
const uploadProductImages = async (files, productId) => {
  try {
    const results = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isPrimary = i === 0;
      
      // Upload original image
      const originalResult = await uploadImage(file, {
        folder: `b2b-nexus/products/${productId}`,
        public_id: `${productId}_${Date.now()}_${i}`,
        tags: ['product', productId]
      });

      // Generate different sizes
      const thumbnailUrl = getThumbnailUrl(originalResult.public_id, 150, 150);
      const mediumUrl = getThumbnailUrl(originalResult.public_id, 400, 400);
      const largeUrl = getThumbnailUrl(originalResult.public_id, 800, 800);

      results.push({
        original: originalResult,
        thumbnail: thumbnailUrl,
        medium: mediumUrl,
        large: largeUrl,
        isPrimary
      });
    }

    return results;
  } catch (error) {
    console.error('Product images upload error:', error);
    throw new Error('Failed to upload product images');
  }
};

// Upload company logo
const uploadCompanyLogo = async (file, companyId) => {
  try {
    const result = await uploadImage(file, {
      folder: `b2b-nexus/companies/${companyId}`,
      public_id: `logo_${companyId}_${Date.now()}`,
      tags: ['company', 'logo', companyId],
      transformation: [
        { width: 200, height: 200, crop: 'fill' },
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ]
    });

    return result;
  } catch (error) {
    console.error('Company logo upload error:', error);
    throw new Error('Failed to upload company logo');
  }
};

// Upload user avatar
const uploadUserAvatar = async (file, userId) => {
  try {
    const result = await uploadImage(file, {
      folder: `b2b-nexus/users/${userId}`,
      public_id: `avatar_${userId}_${Date.now()}`,
      tags: ['user', 'avatar', userId],
      transformation: [
        { width: 150, height: 150, crop: 'fill' },
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ]
    });

    return result;
  } catch (error) {
    console.error('User avatar upload error:', error);
    throw new Error('Failed to upload user avatar');
  }
};

// Clean up unused files
const cleanupUnusedFiles = async (folder, olderThanDays = 7) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: folder,
      max_results: 1000
    });

    const unusedFiles = result.resources.filter(resource => {
      const createdAt = new Date(resource.created_at);
      return createdAt < cutoffDate;
    });

    if (unusedFiles.length > 0) {
      const deletePromises = unusedFiles.map(file => deleteFile(file.public_id));
      await Promise.all(deletePromises);
      
      console.log(`Cleaned up ${unusedFiles.length} unused files from ${folder}`);
    }

    return unusedFiles.length;
  } catch (error) {
    console.error('Cleanup error:', error);
    throw new Error('Failed to cleanup unused files');
  }
};

module.exports = {
  uploadImage,
  uploadMultipleImages,
  uploadDocument,
  deleteFile,
  deleteMultipleFiles,
  getOptimizedImageUrl,
  getThumbnailUrl,
  getResponsiveImageUrls,
  uploadProductImages,
  uploadCompanyLogo,
  uploadUserAvatar,
  cleanupUnusedFiles
};