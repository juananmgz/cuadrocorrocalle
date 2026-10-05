import type {
  FigureKind,
  FigureRotation,
  Piece,
  PieceType,
  PersonRole,
} from '@cuadrocorrocalle/shared';

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
  encore: true,
  participations: {
    select: { personId: true, roles: true, x: true, y: true, figureId: true, slot: true },
    orderBy: { personId: 'asc' },
  },
  figures: { select: { id: true, kind: true, x: true, y: true, rotation: true, width: true } },
} as const;

export function createPrismaPieceRepository(prisma: PrismaClient): PieceRepository {
  const list = async (performanceId: string) => {
    const rows = await prisma.piece.findMany({
      where: { performanceId },
      orderBy: { position: 'asc' },
      select: FIELDS,
    });
    return rows.map(({ participations, figures, ...row }) => ({
      ...row,
      type: row.type as PieceType,
      figures: figures.map((figure) => ({
        ...figure,
        kind: figure.kind as FigureKind,
        rotation: figure.rotation as FigureRotation,
      })),
      participants: participations.map((participation) => ({
        ...participation,
        roles: participation.roles as PersonRole[],
      })),
    }));
  };

  return {
    list,
    async replace(performanceId, pieces) {
      const kept = pieces.flatMap((piece) => (piece.id ? [piece.id] : []));
      await prisma.$transaction(async (tx) => {
        await tx.piece.deleteMany({ where: { performanceId, id: { notIn: kept } } });
        for (const [position, { id, participants, figures, ...data }] of pieces.entries()) {
          const pieceId = id
            ? (await tx.piece.update({ where: { id }, data: { ...data, position } })).id
            : (await tx.piece.create({ data: { ...data, position, performanceId } })).id;
          await tx.participation.deleteMany({ where: { pieceId } });
          // Figures go first, so members can point at them.
          await tx.figure.deleteMany({ where: { pieceId } });
          await tx.figure.createMany({ data: figures.map((figure) => ({ ...figure, pieceId })) });
          await tx.participation.createMany({
            data: participants.map((participant) => ({ ...participant, pieceId, performanceId })),
          });
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
