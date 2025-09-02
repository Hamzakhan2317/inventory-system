import mongoose from "mongoose";
import 'dotenv/config';

export function connectDB() {
  return new Promise((res, rej) => {
    const MONGO_URI = process.env.MONGO_URI;
    
    if (!MONGO_URI) {
      rej(new Error('MONGO_URI environment variable is not defined'));
      return;
    }
    
    mongoose.set("strictQuery", true);
    mongoose.set("bufferCommands", true);
    mongoose
      .connect(MONGO_URI)
      .then(() => {
        console.log("DATABASE IS CONNECTED :)");
        res();
      })
      .catch(rej);
  });
}
