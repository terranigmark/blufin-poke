"use client";

import { useEffect, useState } from "react";
import { LangToggle } from "@/components/LangToggle";
import { useT } from "@/lib/i18n";
import { SAMPLE_ORDER, decodeOrder, type OrderData } from "@/lib/order";
import s from "./ticket.module.css";

/** Waiter view opened by scanning the customer's QR (`/orden#<order>`). */
export function Ticket() {
  const t = useT();
  // undefined = not read yet (server render), null = unreadable link.
  const [order, setOrder] = useState<OrderData | null | undefined>(undefined);

  useEffect(() => {
    const read = () => setOrder(location.hash.length > 1 ? decodeOrder(location.hash) : SAMPLE_ORDER);
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  return (
    <div className={s.page}>
      <div className={s.wrap}>
        <div className={s.head}>
          <div className={s.brand}>
            <span className={s.blufin}>Blufin</span>
            <span className={s.pokeco}>Poke Co</span>
          </div>
          <div className={s.headEnd}>
            <span className={s.badge}>{t("Ticket de mesa", "Table ticket")}</span>
            <LangToggle />
          </div>
        </div>

        {order && (
          <div className={s.body}>
            <div className={s.codeRow}>
              <span className={s.code}>{order.c}</span>
              <span className={s.time}>{order.t}</span>
            </div>
            <div className={s.rows}>
              {order.r.map(([label, value]) => (
                <div key={label} className={s.row}>
                  <span className={s.label}>{label}</span>
                  <span className={s.value}>{value}</span>
                </div>
              ))}
            </div>
            <p className={s.note}>{t("Confirma el pedido con el cliente antes de mandarlo a cocina.", "Confirm the order with the customer before sending it to the kitchen.")}</p>
          </div>
        )}

        {order === null && (
          <div className={s.bad}>
            <span>{t("No pudimos leer este pedido", "We couldn’t read this order")}</span>
            <p>{t("Pide al cliente que te muestre su pantalla y toma el pedido de ahí.", "Ask the customer to show you their screen and take the order from there.")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
