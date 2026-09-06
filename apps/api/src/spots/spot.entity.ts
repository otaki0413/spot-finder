import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import type { Point } from "typeorm";

@Entity("spots")
export class Spot {
  @PrimaryGeneratedColumn("identity")
  id: number;

  @Column({ type: "text" })
  name: string;

  @Column({ type: "text" })
  category: string;

  @Column({ type: "text" })
  address: string;

  @Index("spots_location_idx", { spatial: true })
  @Column({ type: "geography", spatialFeatureType: "Point", srid: 4326 })
  location: Point;
}
