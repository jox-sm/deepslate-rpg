import mongoose from 'mongoose';

const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return; // already connected
  await mongoose.connect(process.env.MONGODB_URI!);
};

export default connectDB;