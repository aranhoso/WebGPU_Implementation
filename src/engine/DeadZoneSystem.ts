export interface DeadZone {
  points: number[][];
  minY: number;
  maxY: number;
  name?: string | undefined;
}

export class DeadZoneSystem {
  private deadZones: DeadZone[] = [];
  private spawnPoint: number[] = [0, 2, 0];
  private lastTriggerTime: number = 0;
  private triggerCooldown: number = 500; // ms entre triggers para evitar spam

  constructor() {}

  public setSpawnPoint(x: number, y: number, z: number): void {
    this.spawnPoint = [x, y, z];
  }

  public getSpawnPoint(): number[] {
    return [...this.spawnPoint];
  }

  public addDeadZone(
    points: number[][],
    minY: number,
    maxY?: number,
    name?: string
  ): void {
    if (points.length < 3) {
      console.warn("DeadZoneSystem: Uma zona precisa de pelo menos 3 pontos");
      return;
    }

    let finalMinY: number;
    let finalMaxY: number;

    if (maxY === undefined) {
      let avgY = 0;
      for (const p of points) {
        avgY += p[1];
      }
      avgY /= points.length;
      finalMinY = avgY - minY;
      finalMaxY = avgY + minY;
    } else {
      finalMinY = minY;
      finalMaxY = maxY;
    }

    const deadZone: DeadZone = {
      points: points.map((p) => [...p]),
      minY: finalMinY,
      maxY: finalMaxY,
      name,
    };

    this.deadZones.push(deadZone);
    console.log(
      `DeadZoneSystem: Adicionada zona '${name || "unnamed"}' com ${
        points.length
      } pontos (Y: ${finalMinY.toFixed(2)} - ${finalMaxY.toFixed(2)})`
    );
  }

  public addDeadZoneBox(min: number[], max: number[], name?: string): void {
    const points = [
      [min[0], min[1], min[2]],
      [max[0], min[1], min[2]],
      [max[0], min[1], max[2]],
      [min[0], min[1], max[2]],
    ];

    const deadZone: DeadZone = {
      points,
      minY: min[1],
      maxY: max[1],
      name,
    };

    this.deadZones.push(deadZone);
    console.log(`DeadZoneSystem: Adicionada zona box '${name || "unnamed"}'`);
  }

  public addKillFloor(height: number, name?: string): void {
    const size = 10000;
    const points = [
      [-size, height, -size],
      [size, height, -size],
      [size, height, size],
      [-size, height, size],
    ];

    const deadZone: DeadZone = {
      points,
      minY: -Infinity,
      maxY: height,
      name: name || "kill_floor",
    };

    this.deadZones.push(deadZone);
    console.log(`DeadZoneSystem: Adicionado kill floor em Y=${height}`);
  }

  public checkPlayerInDeadZone(position: number[]): boolean {
    const now = performance.now();
    if (now - this.lastTriggerTime < this.triggerCooldown) {
      return false;
    }

    for (const zone of this.deadZones) {
      if (this.isPointInDeadZone(position, zone)) {
        this.lastTriggerTime = now;
        console.log(
          `DeadZoneSystem: Jogador entrou na zona '${zone.name || "unnamed"}'`
        );
        return true;
      }
    }

    return false;
  }

  private isPointInDeadZone(point: number[], zone: DeadZone): boolean {
    if (point[1] < zone.minY || point[1] > zone.maxY) {
      return false;
    }

    return this.isPointInPolygon(point[0], point[2], zone.points);
  }

  private isPointInPolygon(x: number, z: number, polygon: number[][]): boolean {
    let inside = false;
    const n = polygon.length;

    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = polygon[i][0],
        zi = polygon[i][2];
      const xj = polygon[j][0],
        zj = polygon[j][2];

      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) {
        inside = !inside;
      }
    }

    return inside;
  }

  public clear(): void {
    this.deadZones = [];
  }

  public getZoneCount(): number {
    return this.deadZones.length;
  }

  public getZonesInfo(): {
    name: string;
    pointCount: number;
    minY: number;
    maxY: number;
  }[] {
    return this.deadZones.map((zone) => ({
      name: zone.name || "unnamed",
      pointCount: zone.points.length,
      minY: zone.minY,
      maxY: zone.maxY,
    }));
  }
}

export function createSealDeadZones(spawnPoint: number[]): DeadZoneSystem {
  const system = new DeadZoneSystem();
  system.setSpawnPoint(spawnPoint[0], spawnPoint[1], spawnPoint[2]);

  const sealFirstZone = [
    [-3.4299999141693114, 8.438132608104555, 9.787470429530066],
    [-3.4397286783239074, 8.438864023448184, 6.561002365263832],
    [0.1672046024101299, 8.85000094740617, 5.6803898344468005],
    [3.6958461214532137, 8.850000953430689, 5.689076898325614],
    [7.603158132980018, 9.320395569496744, 4.298031524127433],
    [9.671025624661475, 9.229428429027838, 4.496430410298217],
    [9.228729331757924, 9.229428429027838, 5.865336021593958],
    [10.549149131575636, 9.00619422903171, 8.081292366500707],
    [11.936925840404234, 8.997071829031638, 7.709866661239447],
    [12.710947749871828, 8.997071829031638, 8.048963879340912],
    [15.59662374692483, 9.016866880779888, 8.0456471490595],
    [17.66123776765747, 10.040348571873183, 5.986300651887711],
    [19.52421508722988, 10.851085774415024, 4.085761793368792],
    [19.60107452548271, 10.872159174285622, 2.2411512409430507],
    [22.96979534628885, 11.712450915582222, 5.763381353986667],
    [26.35678699495952, 13.388395824445094, 6.326159414944365],
    [26.4699991607666, 13.48689002576195, 12.078115739898312],
    [25.529453017342405, 12.986891916907254, 12.860611314909008],
    [25.51873732909464, 12.986891916907254, 14.609473147719038],
    [19.0419697459049, 10.690987238064755, 9.928023679832167],
    [15.085996554139133, 8.979969438079548, 9.059333425711996],
    [11.578017482226372, 8.999411910429036, 9.91724663200131],
    [7.6474466403563355, 9.322396264448487, 8.639467988680032],
    [5.3615269293594245, 9.183341456270295, 8.19501529161477],
    [-3.433949767632991, 8.563750456268577, 9.628718953417936],
  ];

  const sealSecondZone = [
    [-4.57424002406093, 23.379040074614093, 4.091581236664918],
    [-7.582413646659937, 23.379040074614093, 4.3288787657277155],
    [-11.907289577306482, 22.926416474633815, 2.0835706515820687],
    [-19.148361258521064, 23.723547137833137, 3.6189035424542473],
    [-27.602495033685795, 22.73845599888994, 4.116712632513573],
    [-27.54026986055003, 22.73845599888994, 0.399833610676428],
    [-26.256814665360743, 22.925798862439567, 0.39650440853717644],
    [-24.5378753388958, 23.363325221761496, -0.828691161422109],
    [-22.94128654482931, 23.73000183105469, -0.5569687924108794],
    [-19.127602388313765, 23.73000183105469, -1.2798205802267824],
    [-16.563366311051848, 23.400423659591805, -2.8489759584383623],
    [-15.183603540285286, 23.37769545958962, -2.088665817869419],
    [-11.231509794336453, 22.920578459642247, -2.158963505832432],
    [-8.952582708290578, 23.09260575315033, -2.0616196301926992],
    [-7.428963022615293, 23.25000228881836, -1.2742865109282222],
    [-6.795679066579854, 23.25000228881836, -1.8514892769968523],
    [-3.8351945499854025, 23.249376715337384, -1.7244509106908137],
  ];

  system.addDeadZone(sealFirstZone, 0.0, 12.2, "seal_first_zone");

  system.addDeadZone(sealSecondZone, 21.2, 23.4, "seal_second_zone");

  system.addKillFloor(6.0, "kill_floor");

  return system;
}

export function createXmasDeadZones(spawnPoint: number[]): DeadZoneSystem {
  const system = new DeadZoneSystem();
  system.setSpawnPoint(spawnPoint[0], spawnPoint[1], spawnPoint[2]);

  const xmasFirstZone = [
    [5.675, 5.619, -6.023],
    [4.248, 5.63, -7.662],
    [3.173, 5.63, -6.98],
    [1.66, 5.63, -9.938],
    [0.861, 5.63, -12.522],
    [0.599, 5.63, -15.59],
    [0.979, 5.63, -18.353],
    [1.765, 5.63, -21.093],
    [3.349, 5.63, -23.813],
    [5.159, 5.63, -25.991],
    [6.852, 5.63, -27.378],
    [2.905, 5.634, -33.301],
    [0.242, 5.634, -30.582],
    [-2.697, 5.634, -27.372],
    [-4.592, 5.634, -23.374],
    [-5.678, 5.634, -19.733],
    [-6.411, 5.634, -15.313],
    [-5.949, 5.634, -10.953],
    [-4.719, 5.634, -7.062],
    [-2.669, 5.634, -3.032],
    [-3.577, 5.603, -2.425],
    [-1.696, 5.603, -0.596],
    [0.085, 5.603, -0.228],
  ];

  const xmasSecondZone = [
    [10.174913654710737, 5.624929819237128, -29.178766107412276],
    [7.554769049058513, 5.624929819237128, -35.22442461442869],
    [11.091485858449978, 5.624929819237128, -36.84984467657193],
    [14.972733300564009, 5.624929819237128, -37.13281400440947],
    [14.971657471499817, 5.624929819237128, -30.103794564676953],
    [12.368822443594713, 5.624929819237128, -29.567287349338216],
  ];

  const xmasThirdZone = [
    [36.462648662324014, 5.7299970626831085, -24.53630343469087],
    [27.551755025071408, 5.729998016357423, -20.824814906057707],
    [18.079866493361255, 5.729998016357423, -28.220294210430357],
    [20.268902764195577, 5.861683816523237, -37.824019874780525],
    [30.348580247400307, 5.861683816523237, -32.99949738160984],
  ];

  const xmasFourthZone = [
    [6.791901793190875, 5.8441821380637675, -36.65687060897038],
    [10.515262238528221, 5.855149137979906, -27.74014489464856],
    [15.013922629501884, 5.850020699080237, -28.483318024338654],
    [15.009751366818628, 5.862612299135636, -38.1202652914003],
  ];

  const xmasFifthZone = [
    [28.635474861730764, 13.297961800078463, -12.541740030850104],
    [37.56235106063262, 13.302747384971227, -10.643341757183698],
    [36.485619026985844, 13.302747384971227, -6.949809224360238],
    [35.65213674905224, 13.302747384971227, -7.2143665079068064],
    [33.54966168267604, 13.302747384971227, -3.381997094071322],
    [30.650883362693577, 13.302747384971227, -0.23765143123847915],
    [27.527650450889066, 13.302747384971227, 2.707545371318219],
    [23.813154041690773, 13.302747384971227, 4.776346043068018],
    [19.801881029096002, 13.302747384971227, 5.802535802569528],
    [15.341213503668849, 13.302747384971227, 6.399522270091548],
    [11.227949007723776, 13.302747384971227, 6.121482376098688],
    [7.387775132196764, 13.302747384971227, 5.0810788361839965],
    [10.084542251935618, 13.298483444408902, -1.5594959168306828],
    [12.200215775090399, 13.298483444408902, -1.163599001724557],
    [17.93720293948776, 13.298483444408902, -1.1620806155442924],
    [20.906084389125795, 13.298483444408902, -1.9482988385062625],
    [23.43957949182964, 13.298483444408902, -3.1492369170832317],
    [25.905609395507295, 13.298483444408902, -4.986657165589945],
    [27.67074586522915, 13.298483444408902, -6.932165118630054],
    [29.041562317808932, 13.298483444408902, -9.8018354759797],
  ];

  system.addDeadZone(xmasFirstZone, -5.0, 5.7, "xmas_first_deadzone");

  system.addDeadZone(xmasSecondZone, -5.0, 5.7, "xmas_second_deadzone");

  system.addDeadZone(xmasThirdZone, -5.0, 5.9, "xmas_third_deadzone");

  system.addDeadZone(xmasFourthZone, -5.0, 5.9, "xmas_fourth_deadzone");

  system.addDeadZone(xmasFifthZone, 13.0, 13.5, "xmas_fifth_deadzone");

  system.addKillFloor(-10, "global_kill_floor");

  return system;
}
