-- Trigger: preserva campos de geo/comprador existentes em qualquer UPDATE
-- Protege contra upserts de CSV ou webhook que tragam null nesses campos,
-- evitando sobrescrever dados já salvos de outras fontes.

CREATE OR REPLACE FUNCTION preserve_geo_on_update()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.comprador_estado   IS NULL AND OLD.comprador_estado   IS NOT NULL THEN NEW.comprador_estado   := OLD.comprador_estado;   END IF;
    IF NEW.comprador_cidade   IS NULL AND OLD.comprador_cidade   IS NOT NULL THEN NEW.comprador_cidade   := OLD.comprador_cidade;   END IF;
    IF NEW.comprador_cep      IS NULL AND OLD.comprador_cep      IS NOT NULL THEN NEW.comprador_cep      := OLD.comprador_cep;      END IF;
    IF NEW.comprador_nome     IS NULL AND OLD.comprador_nome     IS NOT NULL THEN NEW.comprador_nome     := OLD.comprador_nome;     END IF;
    IF NEW.comprador_email    IS NULL AND OLD.comprador_email    IS NOT NULL THEN NEW.comprador_email    := OLD.comprador_email;    END IF;
    IF NEW.comprador_telefone IS NULL AND OLD.comprador_telefone IS NOT NULL THEN NEW.comprador_telefone := OLD.comprador_telefone; END IF;
    IF NEW.comprador_bairro   IS NULL AND OLD.comprador_bairro   IS NOT NULL THEN NEW.comprador_bairro   := OLD.comprador_bairro;   END IF;
    IF NEW.comprador_end      IS NULL AND OLD.comprador_end      IS NOT NULL THEN NEW.comprador_end      := OLD.comprador_end;      END IF;
    IF NEW.comprador_cpf      IS NULL AND OLD.comprador_cpf      IS NOT NULL THEN NEW.comprador_cpf      := OLD.comprador_cpf;      END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_preserve_geo ON vendas;

CREATE TRIGGER trg_preserve_geo
BEFORE UPDATE ON vendas
FOR EACH ROW
EXECUTE FUNCTION preserve_geo_on_update();
