// DEPRECATED: MongoDB connection has been replaced with PostgreSQL + Prisma
// See services/prisma.ts for the new database connection

// This file is kept for backward compatibility only
// If you still need MongoDB support, install mongoose and uncomment below

// import mongoose from 'mongoose';

// const connectOptions: mongoose.ConnectOptions = {
//   autoCreate: true,
//   retryReads: true,
// };
// const connectMongodb = () => {
//   return mongoose.connect(MONGODB_URL, connectOptions);
// }
// export default connectMongodb;
