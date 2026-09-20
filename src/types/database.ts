// supabase gen types typescript --linked > src/types/database.ts 로 갱신한다.
export type Uuid = string;

export type Profile = {
  id: Uuid;
  nickname: string;
  avatar_url: string | null;
  created_at: string;
};

/** 여행 방. 스팟원들이 장소별 기록을 모으는 단위. */
export type Trip = {
  id: Uuid;
  owner_id: Uuid;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  /** 방장 포함 스팟원 정원 (1~5). */
  capacity: number;
  /** 분할 화면 템플릿 id — src/features/trips/layouts.ts 참고. */
  layout: string;
  /** 스팟원을 부를 때 쓰는 6자리 코드. */
  invite_code: string;
  created_at: string;
};

export type TripRole = 'owner' | 'member';

export type TripMember = {
  trip_id: Uuid;
  user_id: Uuid;
  role: TripRole;
  joined_at: string;
};

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

// supabase-js 는 Row/Insert/Update/Relationships 와
// Tables/Views/Functions/Enums/CompositeTypes 가 모두 있어야 스키마로 인정한다.
// 하나라도 빠지면 쿼리 인자 타입이 never 로 떨어진다.
export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile, Partial<Profile> & { id: Uuid; nickname: string }, Partial<Profile>>;
      trips: Table<
        Trip,
        Omit<Trip, 'id' | 'created_at' | 'invite_code'> & { invite_code?: string },
        Partial<Trip>
      >;
      trip_members: Table<TripMember, Omit<TripMember, 'joined_at'>, Partial<TripMember>>;
    };
    Views: Record<never, never>;
    Functions: {
      join_trip_by_code: {
        Args: { in_code: string };
        Returns: Uuid;
      };
    };
    Enums: { trip_role: TripRole };
    CompositeTypes: Record<never, never>;
  };
};
