import { NextResponse } from "next/server";
import pkg from "pg";

const { Client } = pkg;

export async function GET() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const result = await client.query("SELECT NOW()");
    await client.end();

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("DB error:", error);
    return new NextResponse("Database connection failed", { status: 500 });
  }
}