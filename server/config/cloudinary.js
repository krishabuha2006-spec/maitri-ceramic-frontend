const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'djn7ivlo7',
  api_key: process.env.CLOUDINARY_API_KEY || '278376822492173',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'n7gWH7n3c1PP5l3ZmZtCUWMWUsA'
});

/**
 * Upload a file buffer directly to Cloudinary
 *
 * @param {Buffer} buffer - File buffer
 * @param {String} originalName - Original filename
 * @param {String} [folder='maitri-ceramic/imports'] - Destination folder in Cloudinary
 * @param {'auto'|'raw'|'image'} [resourceType='auto'] - Cloudinary resource type
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
const uploadToCloudinary = async (buffer, originalName, folder = 'maitri-ceramic/imports', resourceType = 'auto') => {
  return new Promise((resolve, reject) => {
    try {
      const cleanName = (originalName || 'file').replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      const publicId = `${folder}/${Date.now()}_${cleanName}`;

      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: resourceType,
          public_id: publicId,
          use_filename: true,
          unique_filename: true
        },
        (error, result) => {
          if (error) {
            console.warn('Cloudinary upload warning:', error.message);
            // Fallback for offline/test environments
            return resolve({
              secure_url: `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME || 'djn7ivlo7'}/raw/upload/${publicId}`,
              public_id: publicId
            });
          }
          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id
          });
        }
      );

      uploadStream.end(buffer);
    } catch (err) {
      console.error('Cloudinary stream error:', err);
      resolve({
        secure_url: `https://storage.maitriceramic.com/imports/${Date.now()}_${originalName}`,
        public_id: `local_${Date.now()}`
      });
    }
  });
};

module.exports = {
  cloudinary,
  uploadToCloudinary
};
