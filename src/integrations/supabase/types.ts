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
      dobra_controle_rg: {
        Row: {
          cliente: string | null
          created_at: string
          data_conclusao: string | null
          data_pacote: string | null
          data_planejamento: string | null
          data_rg: string | null
          eficiencia: number | null
          fpp: string | null
          fpp_key: string | null
          id: string
          import_id: string | null
          produto: string | null
          quantidade: number | null
          rg: string
          rg_key: string
          sla: string | null
          ta_rg: number | null
          tempo_execucao_dias: number | null
          ultima_seq: number | null
          updated_at: string
        }
        Insert: {
          cliente?: string | null
          created_at?: string
          data_conclusao?: string | null
          data_pacote?: string | null
          data_planejamento?: string | null
          data_rg?: string | null
          eficiencia?: number | null
          fpp?: string | null
          fpp_key?: string | null
          id?: string
          import_id?: string | null
          produto?: string | null
          quantidade?: number | null
          rg: string
          rg_key: string
          sla?: string | null
          ta_rg?: number | null
          tempo_execucao_dias?: number | null
          ultima_seq?: number | null
          updated_at?: string
        }
        Update: {
          cliente?: string | null
          created_at?: string
          data_conclusao?: string | null
          data_pacote?: string | null
          data_planejamento?: string | null
          data_rg?: string | null
          eficiencia?: number | null
          fpp?: string | null
          fpp_key?: string | null
          id?: string
          import_id?: string | null
          produto?: string | null
          quantidade?: number | null
          rg?: string
          rg_key?: string
          sla?: string | null
          ta_rg?: number | null
          tempo_execucao_dias?: number | null
          ultima_seq?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dobra_controle_rg_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "dobra_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      dobra_fpps: {
        Row: {
          cliente: string | null
          created_at: string
          data_rg: string | null
          dt_fim_prog: string | null
          dt_pacote: string | null
          dt_planejamento: string | null
          dt_programada: string | null
          fpp: string
          fpp_key: string
          id: string
          import_id: string | null
          item: string | null
          linha: string | null
          maquina: number | null
          produto: string | null
          seq: number | null
          tempo_fpp_seg: number | null
          updated_at: string
        }
        Insert: {
          cliente?: string | null
          created_at?: string
          data_rg?: string | null
          dt_fim_prog?: string | null
          dt_pacote?: string | null
          dt_planejamento?: string | null
          dt_programada?: string | null
          fpp: string
          fpp_key: string
          id?: string
          import_id?: string | null
          item?: string | null
          linha?: string | null
          maquina?: number | null
          produto?: string | null
          seq?: number | null
          tempo_fpp_seg?: number | null
          updated_at?: string
        }
        Update: {
          cliente?: string | null
          created_at?: string
          data_rg?: string | null
          dt_fim_prog?: string | null
          dt_pacote?: string | null
          dt_planejamento?: string | null
          dt_programada?: string | null
          fpp?: string
          fpp_key?: string
          id?: string
          import_id?: string | null
          item?: string | null
          linha?: string | null
          maquina?: number | null
          produto?: string | null
          seq?: number | null
          tempo_fpp_seg?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dobra_fpps_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "dobra_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      dobra_imports: {
        Row: {
          created_at: string
          error_message: string | null
          filename: string
          id: string
          inserted_rows: number
          status: string
          tipo: string
          total_rows: number
          updated_rows: number
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          filename: string
          id?: string
          inserted_rows?: number
          status?: string
          tipo: string
          total_rows?: number
          updated_rows?: number
        }
        Update: {
          created_at?: string
          error_message?: string | null
          filename?: string
          id?: string
          inserted_rows?: number
          status?: string
          tipo?: string
          total_rows?: number
          updated_rows?: number
        }
        Relationships: []
      }
      dobra_performance: {
        Row: {
          created_at: string
          data_final: string | null
          data_inicio: string | null
          fpp: string
          fpp_key: string
          id: string
          import_id: string | null
          maquina: string | null
          obs: string | null
          performance: number | null
          qtd_pecas: number | null
          qtd_produzida: number | null
          qtd_refugo: number | null
          qtd_retrabalho: number | null
          tempo_estimado_seg: number | null
          tempo_planejado_seg: number | null
          tempo_real_seg: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_final?: string | null
          data_inicio?: string | null
          fpp: string
          fpp_key: string
          id?: string
          import_id?: string | null
          maquina?: string | null
          obs?: string | null
          performance?: number | null
          qtd_pecas?: number | null
          qtd_produzida?: number | null
          qtd_refugo?: number | null
          qtd_retrabalho?: number | null
          tempo_estimado_seg?: number | null
          tempo_planejado_seg?: number | null
          tempo_real_seg?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_final?: string | null
          data_inicio?: string | null
          fpp?: string
          fpp_key?: string
          id?: string
          import_id?: string | null
          maquina?: string | null
          obs?: string | null
          performance?: number | null
          qtd_pecas?: number | null
          qtd_produzida?: number | null
          qtd_refugo?: number | null
          qtd_retrabalho?: number | null
          tempo_estimado_seg?: number | null
          tempo_planejado_seg?: number | null
          tempo_real_seg?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dobra_performance_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "dobra_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      dobra_rgs: {
        Row: {
          cliente: string | null
          created_at: string
          data_conclusao: string | null
          data_planejamento: string | null
          data_rg: string | null
          fpp: string | null
          fpp_key: string | null
          id: string
          import_id: string | null
          item_ov: string | null
          maquina_ativa: string | null
          nr_ov: string | null
          operador: string | null
          produto: string | null
          rg: string
          rg_key: string
          status: string | null
          tarefa_desc: string | null
          tempo_seg: number | null
          updated_at: string
        }
        Insert: {
          cliente?: string | null
          created_at?: string
          data_conclusao?: string | null
          data_planejamento?: string | null
          data_rg?: string | null
          fpp?: string | null
          fpp_key?: string | null
          id?: string
          import_id?: string | null
          item_ov?: string | null
          maquina_ativa?: string | null
          nr_ov?: string | null
          operador?: string | null
          produto?: string | null
          rg: string
          rg_key: string
          status?: string | null
          tarefa_desc?: string | null
          tempo_seg?: number | null
          updated_at?: string
        }
        Update: {
          cliente?: string | null
          created_at?: string
          data_conclusao?: string | null
          data_planejamento?: string | null
          data_rg?: string | null
          fpp?: string | null
          fpp_key?: string | null
          id?: string
          import_id?: string | null
          item_ov?: string | null
          maquina_ativa?: string | null
          nr_ov?: string | null
          operador?: string | null
          produto?: string | null
          rg?: string
          rg_key?: string
          status?: string | null
          tarefa_desc?: string | null
          tempo_seg?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dobra_rgs_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "dobra_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      dobra_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      mfa_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          user_id: string
          verified_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          user_id: string
          verified_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          user_id?: string
          verified_at?: string
        }
        Relationships: []
      }
      oee_dias: {
        Row: {
          created_at: string
          data: string
          horas_disp_seg: number | null
          horas_prog_seg: number | null
          horas_reg_seg: number | null
          id: string
          import_id: string | null
          maquina: number
          oee: number | null
          paradas_nao_prog_seg: number | null
          paradas_prog_seg: number | null
          turno: number
        }
        Insert: {
          created_at?: string
          data: string
          horas_disp_seg?: number | null
          horas_prog_seg?: number | null
          horas_reg_seg?: number | null
          id?: string
          import_id?: string | null
          maquina: number
          oee?: number | null
          paradas_nao_prog_seg?: number | null
          paradas_prog_seg?: number | null
          turno: number
        }
        Update: {
          created_at?: string
          data?: string
          horas_disp_seg?: number | null
          horas_prog_seg?: number | null
          horas_reg_seg?: number | null
          id?: string
          import_id?: string | null
          maquina?: number
          oee?: number | null
          paradas_nao_prog_seg?: number | null
          paradas_prog_seg?: number | null
          turno?: number
        }
        Relationships: [
          {
            foreignKeyName: "oee_dias_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "oee_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      oee_imports: {
        Row: {
          arquivo: string
          created_at: string
          id: string
          maquina: number
          mes_ref: string | null
          total_dias: number
          total_paradas: number
          turno: number
        }
        Insert: {
          arquivo: string
          created_at?: string
          id?: string
          maquina: number
          mes_ref?: string | null
          total_dias?: number
          total_paradas?: number
          turno: number
        }
        Update: {
          arquivo?: string
          created_at?: string
          id?: string
          maquina?: number
          mes_ref?: string | null
          total_dias?: number
          total_paradas?: number
          turno?: number
        }
        Relationships: []
      }
      oee_paradas: {
        Row: {
          categoria: string
          created_at: string
          id: string
          import_id: string | null
          maquina: number
          mes_ref: string
          total_seg: number
          turno: number
        }
        Insert: {
          categoria: string
          created_at?: string
          id?: string
          import_id?: string | null
          maquina: number
          mes_ref: string
          total_seg: number
          turno: number
        }
        Update: {
          categoria?: string
          created_at?: string
          id?: string
          import_id?: string | null
          maquina?: number
          mes_ref?: string
          total_seg?: number
          turno?: number
        }
        Relationships: [
          {
            foreignKeyName: "oee_paradas_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "oee_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      product_aliases: {
        Row: {
          canonical_name: string
          created_at: string
          raw_name: string
          updated_at: string
        }
        Insert: {
          canonical_name: string
          created_at?: string
          raw_name: string
          updated_at?: string
        }
        Update: {
          canonical_name?: string
          created_at?: string
          raw_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          canonical_name: string
          created_at: string
          difficulty: number
          notes: string | null
          updated_at: string
        }
        Insert: {
          canonical_name: string
          created_at?: string
          difficulty?: number
          notes?: string | null
          updated_at?: string
        }
        Update: {
          canonical_name?: string
          created_at?: string
          difficulty?: number
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      production_imports: {
        Row: {
          created_at: string
          error_message: string | null
          filename: string
          id: string
          inserted_rows: number
          skipped_rows: number
          status: string
          total_rows: number
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          filename: string
          id?: string
          inserted_rows?: number
          skipped_rows?: number
          status?: string
          total_rows?: number
        }
        Update: {
          created_at?: string
          error_message?: string | null
          filename?: string
          id?: string
          inserted_rows?: number
          skipped_rows?: number
          status?: string
          total_rows?: number
        }
        Relationships: []
      }
      production_records: {
        Row: {
          cliente: string | null
          created_at: string
          data_rg: string | null
          dt_fim_agrup: string | null
          dt_fim_estamparia: string | null
          dt_fim_prog: string | null
          dt_pacote: string | null
          dt_prog: string | null
          fpp: string | null
          id: string
          import_id: string | null
          item: string | null
          linha: string | null
          maquina: number | null
          produto: string | null
          seq: number | null
          tempo_execucao_seg: number | null
          tempo_fpp_seg: number | null
        }
        Insert: {
          cliente?: string | null
          created_at?: string
          data_rg?: string | null
          dt_fim_agrup?: string | null
          dt_fim_estamparia?: string | null
          dt_fim_prog?: string | null
          dt_pacote?: string | null
          dt_prog?: string | null
          fpp?: string | null
          id?: string
          import_id?: string | null
          item?: string | null
          linha?: string | null
          maquina?: number | null
          produto?: string | null
          seq?: number | null
          tempo_execucao_seg?: number | null
          tempo_fpp_seg?: number | null
        }
        Update: {
          cliente?: string | null
          created_at?: string
          data_rg?: string | null
          dt_fim_agrup?: string | null
          dt_fim_estamparia?: string | null
          dt_fim_prog?: string | null
          dt_pacote?: string | null
          dt_prog?: string | null
          fpp?: string | null
          id?: string
          import_id?: string | null
          item?: string | null
          linha?: string | null
          maquina?: number | null
          produto?: string | null
          seq?: number | null
          tempo_execucao_seg?: number | null
          tempo_fpp_seg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "production_records_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "production_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
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
          role: Database["public"]["Enums"]["app_role"]
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
      waste_imports: {
        Row: {
          created_at: string
          error_message: string | null
          filename: string
          id: string
          inserted_rows: number
          skipped_rows: number
          status: string
          total_rows: number
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          filename: string
          id?: string
          inserted_rows?: number
          skipped_rows?: number
          status?: string
          total_rows?: number
        }
        Update: {
          created_at?: string
          error_message?: string | null
          filename?: string
          id?: string
          inserted_rows?: number
          skipped_rows?: number
          status?: string
          total_rows?: number
        }
        Relationships: []
      }
      waste_records: {
        Row: {
          armazem: string | null
          codigo_item: string | null
          created_at: string
          data_registro: string | null
          descricao: string | null
          fator_perda: number | null
          id: string
          import_id: string | null
          linha: number | null
          numero: number | null
          qtde_solicitada: number | null
          retalho: number | null
          status: string | null
          tipo: string | null
        }
        Insert: {
          armazem?: string | null
          codigo_item?: string | null
          created_at?: string
          data_registro?: string | null
          descricao?: string | null
          fator_perda?: number | null
          id?: string
          import_id?: string | null
          linha?: number | null
          numero?: number | null
          qtde_solicitada?: number | null
          retalho?: number | null
          status?: string | null
          tipo?: string | null
        }
        Update: {
          armazem?: string | null
          codigo_item?: string | null
          created_at?: string
          data_registro?: string | null
          descricao?: string | null
          fator_perda?: number | null
          id?: string
          import_id?: string | null
          linha?: number | null
          numero?: number | null
          qtde_solicitada?: number | null
          retalho?: number | null
          status?: string | null
          tipo?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      ia_query: { Args: { sql_text: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "viewer"
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
      app_role: ["admin", "viewer"],
    },
  },
} as const
