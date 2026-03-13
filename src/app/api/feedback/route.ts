import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

const FEEDBACK_DIR = path.join(process.cwd(), 'data');
const FEEDBACK_FILE = path.join(FEEDBACK_DIR, 'feedback.json');

interface FeedbackItem {
  id: string;
  timestamp: string;
  user: string;
  type: 'mejora' | 'bug' | 'solicitud' | 'otro';
  title: string;
  description: string;
  page: string;
  status: 'pendiente' | 'en_revision' | 'implementado' | 'descartado';
}

async function readFeedback(): Promise<FeedbackItem[]> {
  try {
    const data = await readFile(FEEDBACK_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeFeedback(items: FeedbackItem[]): Promise<void> {
  await mkdir(FEEDBACK_DIR, { recursive: true });
  await writeFile(FEEDBACK_FILE, JSON.stringify(items, null, 2), 'utf-8');
}

export async function GET() {
  try {
    const items = await readFeedback();
    return NextResponse.json(items);
  } catch (error) {
    console.error('Error reading feedback:', error);
    return NextResponse.json({ error: 'Error al leer feedback' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user, type, title, description, page } = body;

    if (!title || !description) {
      return NextResponse.json({ error: 'Título y descripción son requeridos' }, { status: 400 });
    }

    const items = await readFeedback();
    const newItem: FeedbackItem = {
      id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      user: user || 'anónimo',
      type: type || 'solicitud',
      title,
      description,
      page: page || '',
      status: 'pendiente',
    };

    items.unshift(newItem);
    await writeFeedback(items);

    return NextResponse.json({ success: true, id: newItem.id });
  } catch (error) {
    console.error('Error saving feedback:', error);
    return NextResponse.json({ error: 'Error al guardar feedback' }, { status: 500 });
  }
}
