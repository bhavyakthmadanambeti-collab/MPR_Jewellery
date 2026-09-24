import { Router } from 'express';
import * as c from '../controllers/owner.controller.js';
import * as auth from '../controllers/auth.controller.js';
import { requireOwner } from '../middleware/auth.js';
import { imageUpload, mediaUpload, videoUpload } from '../middleware/upload.js';

/** Every route in this router requires an authenticated owner/admin (server-side check). */
const r = Router();
r.use(requireOwner);

r.get('/me', auth.ownerMe);
r.put('/password', auth.ownerChangePassword);
r.get('/dashboard', c.dashboard);

r.get('/products', c.listProducts);
r.post('/products', c.createProduct);
r.get('/products/:id', c.getProduct);
r.put('/products/:id', c.updateProduct);
r.delete('/products/:id', c.deleteProduct);
r.post('/products/:id/images', imageUpload.array('images', 30), c.uploadProductImages);
r.put('/products/:id/images/order', c.reorderProductImages);
r.put('/products/:id/images/:imageId', imageUpload.single('image'), c.replaceProductImage);
r.delete('/products/:id/images/:imageId', c.deleteProductImage);
r.post('/products/:id/videos', videoUpload.array('videos', 5), c.uploadProductVideos);
r.put('/products/:id/videos/:videoId', videoUpload.single('video'), c.replaceProductVideo);
r.delete('/products/:id/videos/:videoId', c.deleteProductVideo);

r.get('/collections', c.listCollections);
r.post('/collections', c.createCollection);
r.put('/collections/order', c.reorderCollections);
r.get('/collections/:id', c.getCollection);
r.put('/collections/:id', c.updateCollection);
r.delete('/collections/:id', c.deleteCollection);
r.post('/collections/:id/media', mediaUpload.array('media', 40), c.uploadCollectionMedia);
r.put('/collections/:id/media/order', c.reorderCollectionMedia);
r.put('/collections/:id/media/:mediaId', mediaUpload.single('media'), c.replaceCollectionMedia);
r.patch('/collections/:id/media/:mediaId', c.updateCollectionMedia);
r.delete('/collections/:id/media/:mediaId', c.deleteCollectionMedia);

r.get('/orders', c.listOrders);
r.get('/orders/:id', c.getOrder);
r.put('/orders/:id/payment', c.updatePaymentStatus);
r.put('/orders/:id/status', c.updateOrderStatus);

r.get('/rates', c.getRates);
r.put('/rates', c.updateRates);
r.post('/rates/fetch', c.fetchLiveRates);

r.get('/messages', c.listMessages);
r.put('/messages/:id', c.markMessage);
r.delete('/messages/:id', c.deleteMessage);

r.get('/settings', c.getOwnerSettings);
r.put('/settings', c.updateSettings);
r.post('/settings/logo', imageUpload.single('logo'), c.uploadLogo);
r.delete('/settings/logo', c.removeLogo);

export default r;
