export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      club_action_types: {
        Row: {
          activo: boolean
          created_at: string
          es_resultado: string | null
          grupo: string
          id: string
          nombre: string
          orden: number
          puntos: number
          solo_entrenador: boolean
          solo_portero: boolean
          updated_at: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          es_resultado?: string | null
          grupo?: string
          id: string
          nombre: string
          orden?: number
          puntos?: number
          solo_entrenador?: boolean
          solo_portero?: boolean
          updated_at?: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          es_resultado?: string | null
          grupo?: string
          id?: string
          nombre?: string
          orden?: number
          puntos?: number
          solo_entrenador?: boolean
          solo_portero?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      club_match_actions: {
        Row: {
          action_id: string
          cantidad: number
          created_at: string
          id: string
          match_id: string
          player_id: string
          updated_at: string
        }
        Insert: {
          action_id: string
          cantidad?: number
          created_at?: string
          id?: string
          match_id: string
          player_id: string
          updated_at?: string
        }
        Update: {
          action_id?: string
          cantidad?: number
          created_at?: string
          id?: string
          match_id?: string
          player_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_match_actions_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "club_action_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_match_actions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "club_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_match_actions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "club_players"
            referencedColumns: ["id"]
          },
        ]
      }
      club_match_players: {
        Row: {
          jugado: boolean
          match_id: string
          minutos: number | null
          player_id: string
        }
        Insert: {
          jugado?: boolean
          match_id: string
          minutos?: number | null
          player_id: string
        }
        Update: {
          jugado?: boolean
          match_id?: string
          minutos?: number | null
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_match_players_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "club_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_match_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "club_players"
            referencedColumns: ["id"]
          },
        ]
      }
      club_matches: {
        Row: {
          created_at: string
          es_local: boolean
          fecha: string
          goles_contra: number
          goles_favor: number
          hora: string | null
          id: string
          jornada: number
          rival: string
          season_id: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          es_local?: boolean
          fecha: string
          goles_contra?: number
          goles_favor?: number
          hora?: string | null
          id?: string
          jornada?: number
          rival: string
          season_id: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          es_local?: boolean
          fecha?: string
          goles_contra?: number
          goles_favor?: number
          hora?: string | null
          id?: string
          jornada?: number
          rival?: string
          season_id?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "club_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_matches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "club_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      club_player_positions: {
        Row: {
          es_principal: boolean
          player_id: string
          position_id: string
        }
        Insert: {
          es_principal?: boolean
          player_id: string
          position_id: string
        }
        Update: {
          es_principal?: boolean
          player_id?: string
          position_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_player_positions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "club_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_player_positions_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "club_positions"
            referencedColumns: ["id"]
          },
        ]
      }
      club_player_teams: {
        Row: {
          created_at: string
          dorsal: number | null
          player_id: string
          team_id: string
        }
        Insert: {
          created_at?: string
          dorsal?: number | null
          player_id: string
          team_id: string
        }
        Update: {
          created_at?: string
          dorsal?: number | null
          player_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_player_teams_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "club_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_player_teams_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "club_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      club_players: {
        Row: {
          activo: boolean
          alias: string | null
          anio_nacimiento: number | null
          apellido1: string | null
          apellido2: string | null
          created_at: string
          dorsal: number | null
          es_entrenador: boolean
          estado: Database["public"]["Enums"]["player_estado"]
          id: string
          nombre: string
          sexo: Database["public"]["Enums"]["club_sexo"]
          updated_at: string
        }
        Insert: {
          activo?: boolean
          alias?: string | null
          anio_nacimiento?: number | null
          apellido1?: string | null
          apellido2?: string | null
          created_at?: string
          dorsal?: number | null
          es_entrenador?: boolean
          estado?: Database["public"]["Enums"]["player_estado"]
          id?: string
          nombre: string
          sexo: Database["public"]["Enums"]["club_sexo"]
          updated_at?: string
        }
        Update: {
          activo?: boolean
          alias?: string | null
          anio_nacimiento?: number | null
          apellido1?: string | null
          apellido2?: string | null
          created_at?: string
          dorsal?: number | null
          es_entrenador?: boolean
          estado?: Database["public"]["Enums"]["player_estado"]
          id?: string
          nombre?: string
          sexo?: Database["public"]["Enums"]["club_sexo"]
          updated_at?: string
        }
        Relationships: []
      }
      club_positions: {
        Row: {
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          id: string
          nombre: string
          orden?: number
        }
        Update: {
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      club_seasons: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          nombre: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          nombre: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          nombre?: string
          updated_at?: string
        }
        Relationships: []
      }
      club_teams: {
        Row: {
          categoria: Database["public"]["Enums"]["club_categoria"]
          created_at: string
          id: string
          nombre: string
          season_id: string
          sexo: Database["public"]["Enums"]["club_sexo"]
          updated_at: string
        }
        Insert: {
          categoria: Database["public"]["Enums"]["club_categoria"]
          created_at?: string
          id?: string
          nombre: string
          season_id: string
          sexo: Database["public"]["Enums"]["club_sexo"]
          updated_at?: string
        }
        Update: {
          categoria?: Database["public"]["Enums"]["club_categoria"]
          created_at?: string
          id?: string
          nombre?: string
          season_id?: string
          sexo?: Database["public"]["Enums"]["club_sexo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_teams_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "club_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      jornada_alineaciones_congeladas: {
        Row: {
          created_at: string
          jornada_id: string
          player_id: string | null
          posicion: Database["public"]["Enums"]["plantilla_posicion"]
          user_id: string
        }
        Insert: {
          created_at?: string
          jornada_id: string
          player_id?: string | null
          posicion: Database["public"]["Enums"]["plantilla_posicion"]
          user_id: string
        }
        Update: {
          created_at?: string
          jornada_id?: string
          player_id?: string | null
          posicion?: Database["public"]["Enums"]["plantilla_posicion"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jornada_alineaciones_congeladas_jornada_id_fkey"
            columns: ["jornada_id"]
            isOneToOne: false
            referencedRelation: "jornadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jornada_alineaciones_congeladas_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_pool"
            referencedColumns: ["id"]
          },
        ]
      }
      jornadas: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_locked: boolean
          nombre: string
          numero: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_locked?: boolean
          nombre: string
          numero: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_locked?: boolean
          nombre?: string
          numero?: number
        }
        Relationships: []
      }
      lineups: {
        Row: {
          central: string | null
          created_at: string
          entrenador: string | null
          extremo_der: string | null
          extremo_izq: string | null
          id: string
          jornada_id: string
          lateral_der: string | null
          lateral_izq: string | null
          locked: boolean
          pivote: string | null
          portero: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          central?: string | null
          created_at?: string
          entrenador?: string | null
          extremo_der?: string | null
          extremo_izq?: string | null
          id?: string
          jornada_id: string
          lateral_der?: string | null
          lateral_izq?: string | null
          locked?: boolean
          pivote?: string | null
          portero?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          central?: string | null
          created_at?: string
          entrenador?: string | null
          extremo_der?: string | null
          extremo_izq?: string | null
          id?: string
          jornada_id?: string
          lateral_der?: string | null
          lateral_izq?: string | null
          locked?: boolean
          pivote?: string | null
          portero?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lineups_central_fkey"
            columns: ["central"]
            isOneToOne: false
            referencedRelation: "player_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_entrenador_fkey"
            columns: ["entrenador"]
            isOneToOne: false
            referencedRelation: "player_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_extremo_der_fkey"
            columns: ["extremo_der"]
            isOneToOne: false
            referencedRelation: "player_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_extremo_izq_fkey"
            columns: ["extremo_izq"]
            isOneToOne: false
            referencedRelation: "player_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_jornada_id_fkey"
            columns: ["jornada_id"]
            isOneToOne: false
            referencedRelation: "jornadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_lateral_der_fkey"
            columns: ["lateral_der"]
            isOneToOne: false
            referencedRelation: "player_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_lateral_izq_fkey"
            columns: ["lateral_izq"]
            isOneToOne: false
            referencedRelation: "player_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_pivote_fkey"
            columns: ["pivote"]
            isOneToOne: false
            referencedRelation: "player_pool"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_portero_fkey"
            columns: ["portero"]
            isOneToOne: false
            referencedRelation: "player_pool"
            referencedColumns: ["id"]
          },
        ]
      }
      misiones: {
        Row: {
          codigo_qr: string | null
          created_at: string
          descripcion: string
          espera_segundos: number
          id: string
          is_active: boolean
          nombre: string
          recompensa_sobres: number
          requiere_qr: boolean | null
          semanal: boolean
          tipo_sobre: string
        }
        Insert: {
          codigo_qr?: string | null
          created_at?: string
          descripcion: string
          espera_segundos?: number
          id?: string
          is_active?: boolean
          nombre: string
          recompensa_sobres?: number
          requiere_qr?: boolean | null
          semanal?: boolean
          tipo_sobre?: string
        }
        Update: {
          codigo_qr?: string | null
          created_at?: string
          descripcion?: string
          espera_segundos?: number
          id?: string
          is_active?: boolean
          nombre?: string
          recompensa_sobres?: number
          requiere_qr?: boolean | null
          semanal?: boolean
          tipo_sobre?: string
        }
        Relationships: []
      }
      player_jornada_stats: {
        Row: {
          created_at: string
          estado: Database["public"]["Enums"]["player_estado"]
          id: string
          jornada_numero: number
          player_id: string
          puntos: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          estado?: Database["public"]["Enums"]["player_estado"]
          id?: string
          jornada_numero: number
          player_id: string
          puntos?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          estado?: Database["public"]["Enums"]["player_estado"]
          id?: string
          jornada_numero?: number
          player_id?: string
          puntos?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_jornada_stats_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_pool"
            referencedColumns: ["id"]
          },
        ]
      }
      player_pool: {
        Row: {
          apellido1: string | null
          club_player_id: string | null
          created_at: string
          dorsal: number | null
          estado: Database["public"]["Enums"]["player_estado"]
          id: string
          nombre: string
          posicion: Database["public"]["Enums"]["plantilla_posicion"]
          rareza: Database["public"]["Enums"]["card_rareza"]
          rating: number
          team_id: string | null
        }
        Insert: {
          apellido1?: string | null
          club_player_id?: string | null
          created_at?: string
          dorsal?: number | null
          estado?: Database["public"]["Enums"]["player_estado"]
          id: string
          nombre: string
          posicion: Database["public"]["Enums"]["plantilla_posicion"]
          rareza?: Database["public"]["Enums"]["card_rareza"]
          rating?: number
          team_id?: string | null
        }
        Update: {
          apellido1?: string | null
          club_player_id?: string | null
          created_at?: string
          dorsal?: number | null
          estado?: Database["public"]["Enums"]["player_estado"]
          id?: string
          nombre?: string
          posicion?: Database["public"]["Enums"]["plantilla_posicion"]
          rareza?: Database["public"]["Enums"]["card_rareza"]
          rating?: number
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_pool_club_player_id_fkey"
            columns: ["club_player_id"]
            isOneToOne: false
            referencedRelation: "club_players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_pool_positions: {
        Row: {
          created_at: string
          es_principal: boolean
          player_id: string
          posicion: Database["public"]["Enums"]["plantilla_posicion"]
        }
        Insert: {
          created_at?: string
          es_principal?: boolean
          player_id: string
          posicion: Database["public"]["Enums"]["plantilla_posicion"]
        }
        Update: {
          created_at?: string
          es_principal?: boolean
          player_id?: string
          posicion?: Database["public"]["Enums"]["plantilla_posicion"]
        }
        Relationships: [
          {
            foreignKeyName: "player_pool_positions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_pool"
            referencedColumns: ["id"]
          },
        ]
      }
      player_usage: {
        Row: {
          player_id: string
          user_id: string
          usos_gastados: number
        }
        Insert: {
          player_id: string
          user_id: string
          usos_gastados?: number
        }
        Update: {
          player_id?: string
          user_id?: string
          usos_gastados?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_usage_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_pool"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          apellido: string | null
          created_at: string
          display_name: string | null
          dni: string
          id: string
          nombre: string | null
          tutorial_visto: boolean
          updated_at: string
          username: string | null
        }
        Insert: {
          apellido?: string | null
          created_at?: string
          display_name?: string | null
          dni: string
          id: string
          nombre?: string | null
          tutorial_visto?: boolean
          updated_at?: string
          username?: string | null
        }
        Update: {
          apellido?: string | null
          created_at?: string
          display_name?: string | null
          dni?: string
          id?: string
          nombre?: string | null
          tutorial_visto?: boolean
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      user_misiones: {
        Row: {
          claimed_at: string
          mision_id: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          mision_id: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          mision_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_misiones_mision_id_fkey"
            columns: ["mision_id"]
            isOneToOne: false
            referencedRelation: "misiones"
            referencedColumns: ["id"]
          },
        ]
      }
      user_players: {
        Row: {
          id: string
          obtained_at: string
          player_id: string
          user_id: string
          usos: number
        }
        Insert: {
          id?: string
          obtained_at?: string
          player_id: string
          user_id: string
          usos?: number
        }
        Update: {
          id?: string
          obtained_at?: string
          player_id?: string
          user_id?: string
          usos?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_pool"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_wallet: {
        Row: {
          sobres: number
          sobres_premium: number
          updated_at: string
          user_id: string
        }
        Insert: {
          sobres?: number
          sobres_premium?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          sobres?: number
          sobres_premium?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      club_player_match_points: {
        Row: {
          match_id: string | null
          player_id: string | null
          puntos: number | null
        }
        Relationships: [
          {
            foreignKeyName: "club_match_actions_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "club_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_match_actions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "club_players"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_save_player: {
        Args: {
          _activo: boolean
          _alias: string
          _anio_nacimiento: number
          _apellido1: string
          _apellido2: string
          _dorsal: number
          _es_entrenador: boolean
          _estado: Database["public"]["Enums"]["player_estado"]
          _id: string
          _nombre: string
          _positions: string[]
          _principal: string
          _sexo: Database["public"]["Enums"]["club_sexo"]
          _team_ids: string[]
        }
        Returns: string
      }
      claim_mision: { Args: { _mision_id: string }; Returns: number }
      claim_qr: { Args: { _codigo: string }; Returns: number }
      close_jornada: { Args: { _jornada_id: string }; Returns: undefined }
      dni_exists: { Args: { _dni: string }; Returns: boolean }
      effective_lineup_players: {
        Args: never
        Returns: {
          jornada_id: string
          numero: number
          player_id: string
          user_id: string
        }[]
      }
      email_for_dni: { Args: { _dni: string }; Returns: string }
      email_for_username: { Args: { _username: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_tutorial_visto: { Args: never; Returns: undefined }
      open_sobre: {
        Args: { _tipo?: string }
        Returns: {
          p_id: string
          p_nombre: string
          p_posicion: Database["public"]["Enums"]["plantilla_posicion"]
          p_rareza: Database["public"]["Enums"]["card_rareza"]
          p_rating: number
        }[]
      }
      recalc_player_stats: { Args: never; Returns: undefined }
      set_player_activo: {
        Args: { _activo: boolean; _player_id: string }
        Returns: undefined
      }
      user_ranking: {
        Args: never
        Returns: {
          display_name: string
          jornadas: number
          puntos: number
          user_id: string
          username: string
        }[]
      }
      user_ranking_by_jornada: {
        Args: never
        Returns: {
          display_name: string
          jornada: number
          puntos: number
          user_id: string
          username: string
        }[]
      }
      username_exists: { Args: { _username: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "manager" | "super_admin"
      card_rareza: "normal" | "raro" | "legendario"
      club_categoria: "cadete" | "juvenil" | "senior"
      club_sexo: "masculino" | "femenino"
      plantilla_posicion:
        | "portero"
        | "extremo_izq"
        | "extremo_der"
        | "lateral_izq"
        | "lateral_der"
        | "central"
        | "pivote"
        | "entrenador"
      player_estado: "disponible" | "dudoso" | "no_disponible"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user", "manager", "super_admin"],
      card_rareza: ["normal", "raro", "legendario"],
      club_categoria: ["cadete", "juvenil", "senior"],
      club_sexo: ["masculino", "femenino"],
      plantilla_posicion: [
        "portero",
        "extremo_izq",
        "extremo_der",
        "lateral_izq",
        "lateral_der",
        "central",
        "pivote",
        "entrenador",
      ],
      player_estado: ["disponible", "dudoso", "no_disponible"],
    },
  },
} as const
