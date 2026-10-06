"use client";

import { useEffect, useState } from "react";
import { SAMPLE_ORDER, decodeOrder, type OrderData } from "@/lib/order";
import s from "./ticket.module.css";

/** Waiter view opened by scanning the customer's QR (`/orden#<order>`). */
export function Ticket() {
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
          <span className={s.badge}>Ticket de mesa</span>
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
            <p className={s.note}>Confirma el pedido con el cliente antes de mandarlo a cocina.</p>
          </div>
        )}

        {order === null && (
          <div className={s.bad}>
            <span>No pudimos leer este pedido</span>
            <p>Pide al cliente que te muestre su pantalla y toma el pedido de ahí.</p>
          </div>
        )}
      </div>
    </div>
  );
}
