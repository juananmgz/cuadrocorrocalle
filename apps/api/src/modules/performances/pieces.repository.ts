import type { Piece, PieceType } from '@cuadrocorrocalle/shared';

import type { PrismaClient } from '../../generated/prisma/client';

/** A piece to store; pieces without id are created. */
export type PieceDraft = Omit<Piece, 'id'> & { id?: string };

export interface PieceRepository {
  /** The repertoire of a performance, in order. */
  list(performanceId: string): Promise<Piece[]>;
  /** Replaces the whole repertoire, keeping the ids of pieces that stay. */
  replace(performanceId: string, pieces: PieceDraft[]): Promise<Piece[]>;
}

const FIELDS = {
  id: true,
  title: true,
  type: true,
  durationSeconds: true,
  structure: true,
  optional: true,
} as const;

export function createPrismaPieceRepository(prisma: PrismaClient): PieceRepository {
  const list = async (performanceId: string) => {
    const rows = await prisma.piece.findMany({
      where: { performanceId },
      orderBy: { position: 'asc' },
      select: FIELDS,
    });
    return rows.map((row) => ({ ...row, type: row.type as PieceType }));
  };

  return {
    list,
    async replace(performanceId, pieces) {
      const kept = pieces.flatMap((piece) => (piece.id ? [piece.id] : []));
      await prisma.$transaction(async (tx) => {
        await tx.piece.deleteMany({ where: { performanceId, id: { notIn: kept } } });
        for (const [position, { id, ...data }] of pieces.entries()) {
          if (id) await tx.piece.update({ where: { id }, data: { ...data, position } });
          else await tx.piece.create({ data: { ...data, position, performanceId } });
        }
      });
      return list(performanceId);
    },
  };
}

/** In-memory repository for tests. */
export function createMemoryPieceRepository(): PieceRepository {
  const repertoires = new Map<string, Piece[]>();
  let lastId = 0;

  return {
    async list(performanceId) {
      return repertoires.get(performanceId) ?? [];
    },
    async replace(performanceId, pieces) {
      const stored = pieces.map((piece) => ({ ...piece, id: piece.id ?? `piece-${++lastId}` }));
      repertoires.set(performanceId, stored);
      return stored;
    },
  };
}
