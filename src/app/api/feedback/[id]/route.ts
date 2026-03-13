import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';

const FEEDBACK_DIR = path.join(process.cwd(), 'data');
const FEEDBACK_FILE = path.join(FEEDBACK_DIR, 'feedback.json');

async function readFeedback() {
  try {
    const data = await readFile(FEEDBACK_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeFeedback(items: unknown[]): Promise<void> {
  await mkdir(FEEDBACK_DIR, { recursive: true });
  await writeFile(FEEDBACK_FILE, JSON.stringify(items, null, 2), 'utf-8');
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { status } = await req.json();
    const validStatuses = ['pendiente', 'en_revision', 'implementado', 'descartado'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
    }

    const items = await readFeedback();
    const idx = items.findIndex((i: { id: string }) => i.id === params.id);
    if (idx === -1) {
      return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    items[idx].status = status;
    await writeFeedback(items);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating feedback:', error);
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const items = await readFeedback();
    const filtered = items.filter((i: { id: string }) => i.id !== params.id);
    await writeFeedback(filtered);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });
  }
}
