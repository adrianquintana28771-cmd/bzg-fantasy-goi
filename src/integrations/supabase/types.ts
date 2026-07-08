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
          created_at: string
          descripcion: string
          id: string
          is_active: boolean
          nombre: string
          recompensa_sobres: number
        }
        Insert: {
          created_at?: string
          descripcion: string
          id?: string
          is_active?: boolean
          nombre: string
          recompensa_sobres?: number
        }
        Update: {
          created_at?: string
          descripcion?: string
          id?: string
          is_active?: boolean
          nombre?: string
          recompensa_sobres?: number
        }
        Relationships: []
      }
      player_pool: {
        Row: {
          created_at: string
          id: string
          nombre: string
          posicion: Database["public"]["Enums"]["plantilla_posicion"]
          rating: number
          team_id: string | null
        }
        Insert: {
          created_at?: string
          id: string
          nombre: string
          posicion: Database["public"]["Enums"]["plantilla_posicion"]
          rating?: number
          team_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
          posicion?: Database["public"]["Enums"]["plantilla_posicion"]
          rating?: number
          team_id?: string | null
        }
        Relationships: []
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
          created_at: string
          display_name: string | null
          dni: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          dni: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          dni?: string
          id?: string
          updated_at?: string
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
          obtained_at: string
          player_id: string
          user_id: string
        }
        Insert: {
          obtained_at?: string
          player_id: string
          user_id: string
        }
        Update: {
          obtained_at?: string
          player_id?: string
          user_id?: string
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
          updated_at: string
          user_id: string
        }
        Insert: {
          sobres?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          sobres?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_mision: { Args: { _mision_id: string }; Returns: number }
      close_jornada: { Args: { _jornada_id: string }; Returns: undefined }
      dni_exists: { Args: { _dni: string }; Returns: boolean }
      email_for_dni: { Args: { _dni: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      open_sobre: {
        Args: never
        Returns: {
          p_id: string
          p_nombre: string
          p_posicion: Database["public"]["Enums"]["plantilla_posicion"]
          p_rating: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "manager" | "super_admin"
      plantilla_posicion:
        | "portero"
        | "extremo_izq"
        | "extremo_der"
        | "lateral_izq"
        | "lateral_der"
        | "central"
        | "pivote"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      plantilla_posicion: [
        "portero",
        "extremo_izq",
        "extremo_der",
        "lateral_izq",
        "lateral_der",
        "central",
        "pivote",
      ],
    },
  },
} as const
