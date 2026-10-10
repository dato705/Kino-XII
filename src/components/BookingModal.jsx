import { useMemo } from 'react';

const money = (value) => `₾ ${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const seatId = (seat) => String(seat.id);

const getSessionTitle = (session) => session?.movie?.title || session?.movie_title || session?.title || 'Cinema session';
const getSessionVenue = (session) => session?.venue?.name || session?.venueName || session?.cinema?.name || session?.venue_name || session?.venue || '';
const getSessionHall = (session) => session?.hall?.name || session?.auditorium?.name || session?.room?.name || session?.hall_name || session?.room_name || '';
const getSessionFormat = (session) => session?.format?.name || session?.format?.label || session?.format || '';
const getSessionLanguage = (session) => session?.language?.name || session?.language?.label || session?.language || '';

const getSessionDateTime = (session) => {
  const value = session?.startsAt || session?.starts_at || session?.start_time || session?.datetime || session?.date;
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};

const seatStatus = (seat) => String(seat.status ?? seat.state ?? '').toLowerCase();
const isHeldByOther = (seat) => seatStatus(seat) === 'held' && !seat.isMine;
const isSoldSeat = (seat) => ['sold', 'reserved', 'occupied', 'contested', 'unavailable'].includes(seatStatus(seat));
const getFieldError = (errors, key) => {
  const error = errors?.[key];
  return Array.isArray(error) ? error[0] : error;
};
const formatCardNumber = (value) => value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ');
const formatExpiry = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length >= 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
};
const getCaretPosition = (value, digitCount) => {
  if (!digitCount) return 0;
  let foundDigits = 0;
  let position = 0;
  while (position < value.length && foundDigits < digitCount) {
    if (/\d/.test(value[position])) foundDigits += 1;
    position += 1;
  }
  return position;
};

export default function BookingModal({
  session,
  seatSections,
  seats,
  selectedSeats,
  ticketTypes,
  seatErrors,
  seatLoading,
  bookingLoading,
  releaseLoading,
  bookingError,
  bookingRetryAction,
  hold,
  order,
  remainingHoldSeconds,
  seatCap,
  ticketTypeOptions,
  payment,
  paymentErrors,
  ageAllowed,
  ageMessage,
  step,
  onClose,
  onToggleSeat,
  onTicketTypeChange,
  onPaymentChange,
  onHoldSeats,
  onConfirmOrder,
  onRetryBooking,
  onBackToSeats,
  onViewTickets,
}) {
  const title = getSessionTitle(session);
  const dateTime = getSessionDateTime(session);
  const venue = getSessionVenue(session);
  const hall = getSessionHall(session);
  const format = getSessionFormat(session);
  const language = getSessionLanguage(session);
  const movie = session?.movie || {};
  const poster = movie.posterUrl || movie.poster_url || movie.cover;
  const backdrop = movie.backdropUrl || movie.backdrop_url || poster;
  const holdTime = remainingHoldSeconds === null
    ? '8:00'
    : `${Math.floor(remainingHoldSeconds / 60)}:${String(remainingHoldSeconds % 60).padStart(2, '0')}`;

  const ticketLines = useMemo(() => selectedSeats.map((id) => {
    const seat = seats.find((item) => seatId(item) === id);
    const typeSlug = ticketTypes[id] || 'adult';
    const ticketType = ticketTypeOptions.find((option) => option.value === typeSlug);
    const ratio = Number(ticketType?.priceRatio ?? 1);
    const basePrice = Number(seat?.price ?? seat?.basePrice ?? session?.price ?? session?.ticketPrice ?? session?.ticket_price ?? 0);
    return {
      id,
      code: seat?.code || `Seat ${seat?.label ?? ''}`,
      typeSlug,
      typeName: ticketType?.label || 'Adult',
      ratio,
      basePrice,
      price: Math.round(basePrice * ratio * 100) / 100,
    };
  }), [selectedSeats, seats, ticketTypes, ticketTypeOptions, session]);

  const subtotal = ticketLines.reduce((sum, ticket) => sum + ticket.price, 0);
  const ticketsSummary = ticketLines.reduce((summary, ticket) => {
    summary[ticket.typeName] = (summary[ticket.typeName] || 0) + 1;
    return summary;
  }, {});
  const ticketsDescription = Object.entries(ticketsSummary).map(([name, count]) => `${count} × ${name}`).join(', ');
  const isUnderAge = !ageAllowed;

  const handleFormattedInput = (event, key, formatter) => {
    const input = event.currentTarget;
    const digitsBeforeCaret = input.value.slice(0, input.selectionStart ?? input.value.length).replace(/\D/g, '').length;
    const formattedValue = formatter(input.value);
    onPaymentChange(key, formattedValue);
    requestAnimationFrame(() => {
      const position = getCaretPosition(formattedValue, digitsBeforeCaret);
      input.setSelectionRange(position, position);
    });
  };

  const submitHold = async () => {
    await onHoldSeats();
  };

  const backToSeats = async () => {
    if (step === 'checkout') await onBackToSeats();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[#050817]/70 p-3 backdrop-blur-sm sm:p-6"
      style={backdrop ? { backgroundImage: `linear-gradient(rgba(5, 8, 23, .78), rgba(5, 8, 23, .86)), url("${backdrop}")`, backgroundPosition: 'center', backgroundSize: 'cover' } : undefined}
      onClick={bookingLoading ? undefined : onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-title"
        className="relative my-auto w-full max-w-5xl overflow-hidden rounded-2xl border border-white/5 bg-[#070b1b] text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {order ? (
          <div className="mx-auto flex min-h-[430px] max-w-xl flex-col items-center justify-center px-5 py-10 text-center sm:px-10">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400 text-2xl font-bold text-white" aria-hidden="true">✓</span>
            <h2 className="mt-3 text-xl font-bold">Booking confirmed!</h2>
            <p className="mt-2 max-w-sm text-xs text-gray-400">Your tickets are ready. We&apos;ve sent the confirmation to your email.</p>
            <p className="mt-4 rounded-full bg-[#202337] px-6 py-1.5 text-[10px] font-semibold uppercase tracking-wide">Order #{order.reference || order.code || order.id}</p>
            <div className="mt-4 w-full rounded-xl bg-[#1b1d30] p-4 text-left">
              <div className="flex items-center gap-3">
                {poster && <img src={poster} alt="" className="h-14 w-10 rounded object-cover" />}
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold">{title}</p>
                  <p className="mt-1 text-[10px] text-gray-400">{venue}{hall ? ` · Hall ${hall}` : ''} · {dateTime}</p>
                </div>
              </div>
              <div className="mt-3 space-y-2 border-t border-white/5 pt-3 text-[10px] text-gray-300">
                <p className="flex justify-between gap-4"><span>Seats</span><span>{ticketLines.map((ticket) => ticket.code).join(', ')}</span></p>
                <p className="flex justify-between gap-4"><span>Tickets</span><span>{ticketsDescription}</span></p>
                <p className="flex justify-between border-t border-white/5 pt-2 text-xs font-bold text-white"><span>Total paid</span><span>{money(subtotal)}</span></p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button type="button" onClick={onViewTickets} className="rounded-full bg-[#f12d13] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-red-600">View my tickets</button>
              <button type="button" onClick={onClose} className="rounded-full bg-[#202337] px-5 py-2.5 text-xs font-bold text-white transition hover:bg-[#2a2e44]">Back to sessions</button>
            </div>
          </div>
        ) : (
          <>
            <header className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-7 sm:pt-6">
              <div className="min-w-0">
                <h2 id="booking-title" className="truncate text-sm font-bold uppercase sm:text-base">{title}</h2>
                <p className="mt-1 truncate text-[9px] text-gray-400 sm:text-[10px]">{venue}{hall ? ` · Hall ${hall}` : ''} · {dateTime} · {format}{language ? ` · ${language}` : ''}</p>
              </div>
              <div className="shrink-0 rounded-lg bg-[#1b1d30] px-3 py-1.5 text-center">
                <span className="block text-[8px] uppercase text-gray-400">Seats held</span>
                <span className="block text-[10px] font-bold tabular-nums">{hold ? holdTime : '--:--'}</span>
              </div>
            </header>

            <div className="grid gap-0 px-4 pb-5 pt-4 sm:px-7 sm:pb-6 lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-4">
              <div className="min-w-0">
                <div className="grid grid-cols-2 rounded-full bg-[#1c2032] p-0.5 text-center text-[9px] font-semibold uppercase">
                  <button type="button" onClick={() => step === 'checkout' && backToSeats()} disabled={bookingLoading} className={`rounded-full py-2 transition disabled:cursor-not-allowed disabled:opacity-50 ${step === 'seats' ? 'bg-[#f12d13] text-white' : 'text-gray-300 hover:text-white'}`}>Seats</button>
                  <button type="button" disabled={!hold} className={`rounded-full py-2 transition disabled:cursor-not-allowed disabled:opacity-60 ${step === 'checkout' ? 'bg-[#f12d13] text-white' : 'text-gray-300 hover:text-white'}`}>Checkout</button>
                </div>

                {step === 'seats' ? (
                  <div className="mt-3">
                    <div className="mx-auto mb-5 w-[94%] rounded-b-2xl bg-[#282b3d] py-1.5 text-center text-[9px] font-semibold uppercase">Screen</div>
                    {seatLoading ? <p className="py-12 text-center text-xs text-gray-400">Loading seats...</p> : (
                      <div className="max-h-[52vh] space-y-5 overflow-y-auto px-1 py-1">
                        {seatSections.map((section) => (
                          <section key={section.id || section.name}>
                            <h3 className="mb-3 text-[9px] font-medium uppercase text-gray-400">{section.name}</h3>
                            <div className="space-y-2">
                              {(section.rows || []).map((row) => (
                                <div key={row.id || row.label || row.name} className="flex items-center justify-center gap-1.5 sm:gap-2">
                                  <span className="w-4 shrink-0 text-center text-[9px] text-gray-300">{row.label || row.name}</span>
                                  <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
                                    {(row.seats || []).map((seat) => {
                                      const id = seatId(seat);
                                      const unavailable = isSoldSeat(seat) || isHeldByOther(seat) || seat.available === false || seat.is_available === false;
                                      const selected = selectedSeats.includes(id) || seat.isMine;
                                      const held = isHeldByOther(seat);
                                      const sold = isSoldSeat(seat) && seatStatus(seat) !== 'unavailable';
                                      const statusLabel = selected ? 'selected' : held ? 'held by another user' : sold ? 'sold' : unavailable ? 'unavailable' : 'available';
                                      return (
                                        <button
                                          key={id}
                                          type="button"
                                          onClick={() => onToggleSeat(seat)}
                                          disabled={unavailable || Boolean(hold) || seatLoading || bookingLoading}
                                          aria-pressed={selected}
                                          aria-invalid={seatErrors.includes(id)}
                                          aria-label={`Seat ${seat.code}, ${statusLabel}`}
                                          title={`${seat.code} · ${statusLabel}${seat.isMine ? ' · Yours' : ''}`}
                                          className={`flex h-8 min-w-6 shrink-0 items-center justify-center rounded-md border px-1 text-[9px] font-semibold transition sm:min-w-9 sm:px-2 ${
                                            seatErrors.includes(id) ? 'border-red-400 bg-red-900 text-white' :
                                              selected ? 'border-[#f12d13] bg-[#f12d13] text-white' :
                                                  held ? 'border border-[#bd762d] bg-[repeating-linear-gradient(135deg,#75461c_0px,#75461c_5px,#a65d26_5px,#a65d26_10px)] text-amber-100' :
                                                    unavailable ? 'border border-[#3d4153] bg-[#25283a] text-gray-300' :
                                                    'border-[#718096] bg-[#354054] text-gray-100 hover:border-gray-300 hover:bg-[#414c63]'
                                          }`}
                                        >
                                          {seat.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <span className="w-4 shrink-0 text-center text-[9px] text-gray-300">{row.label || row.name}</span>
                                </div>
                              ))}
                            </div>
                          </section>
                        ))}
                        {!seatSections.length && !bookingError && <p className="py-8 text-center text-xs text-gray-400">Seat map is unavailable.</p>}
                      </div>
                    )}
                    <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[9px] text-gray-400">
                      <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded border border-[#718096] bg-[#354054]" />Available</span>
                      <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-[#f12d13]" />Selected</span>
                      <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded border border-[#3d4153] bg-[#25283a]" />Sold / unavailable</span>
                      <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded border border-[#bd762d] bg-[repeating-linear-gradient(135deg,#75461c_0px,#75461c_4px,#a65d26_4px,#a65d26_8px)]" />Held by another user</span>
                    </div>
                  </div>
                ) : (
                  <form id="booking-checkout-form" onSubmit={onConfirmOrder} className="mt-4 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1 text-[9px] font-semibold text-gray-300 sm:col-span-2">
                        <span>Full Name</span>
                        <input type="text" value={payment.fullName} onChange={(event) => onPaymentChange('fullName', event.target.value)} autoComplete="name" className={`w-full rounded-lg border bg-[#1c2032] px-3 py-2.5 text-xs text-white outline-none focus:border-red-500 ${paymentErrors.fullName ? 'border-red-500' : 'border-transparent'}`} />
                        {getFieldError(paymentErrors, 'fullName') && <span className="block text-red-400">{getFieldError(paymentErrors, 'fullName')}</span>}
                      </label>
                      <label className="space-y-1 text-[9px] font-semibold text-gray-300">
                        <span>Email</span>
                        <input type="email" value={payment.email} onChange={(event) => onPaymentChange('email', event.target.value)} autoComplete="email" className={`w-full rounded-lg border bg-[#1c2032] px-3 py-2.5 text-xs text-white outline-none focus:border-red-500 ${paymentErrors.email ? 'border-red-500' : 'border-transparent'}`} />
                        {getFieldError(paymentErrors, 'email') && <span className="block text-red-400">{getFieldError(paymentErrors, 'email')}</span>}
                      </label>
                      <label className="space-y-1 text-[9px] font-semibold text-gray-300">
                        <span>Mobile Number</span>
                        <input type="tel" value={payment.mobileNumber} onChange={(event) => onPaymentChange('mobileNumber', event.target.value)} autoComplete="tel" className={`w-full rounded-lg border bg-[#1c2032] px-3 py-2.5 text-xs text-white outline-none focus:border-red-500 ${paymentErrors.mobileNumber ? 'border-red-500' : 'border-transparent'}`} />
                        {getFieldError(paymentErrors, 'mobileNumber') && <span className="block text-red-400">{getFieldError(paymentErrors, 'mobileNumber')}</span>}
                      </label>
                    </div>
                    <div className="border-t border-white/5 pt-3">
                      <label className="block space-y-1 text-[9px] font-semibold text-gray-300">
                        <span>Card Number</span>
                        <input type="text" value={payment.cardNumber} onChange={(event) => handleFormattedInput(event, 'cardNumber', formatCardNumber)} autoComplete="cc-number" inputMode="numeric" maxLength={19} placeholder="0000 0000 0000 0000" className={`w-full rounded-lg border bg-[#1c2032] px-3 py-2.5 text-xs text-white outline-none focus:border-red-500 ${paymentErrors.cardNumber ? 'border-red-500' : 'border-transparent'}`} />
                        {getFieldError(paymentErrors, 'cardNumber') && <span className="block text-red-400">{getFieldError(paymentErrors, 'cardNumber')}</span>}
                      </label>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1 text-[9px] font-semibold text-gray-300">
                          <span>Expiry</span>
                          <input type="text" value={payment.expiry} onChange={(event) => handleFormattedInput(event, 'expiry', formatExpiry)} autoComplete="cc-exp" inputMode="numeric" maxLength={5} placeholder="MM/YY" className={`w-full rounded-lg border bg-[#1c2032] px-3 py-2.5 text-xs text-white outline-none focus:border-red-500 ${paymentErrors.expiry ? 'border-red-500' : 'border-transparent'}`} />
                          {getFieldError(paymentErrors, 'expiry') && <span className="block text-red-400">{getFieldError(paymentErrors, 'expiry')}</span>}
                        </label>
                        <label className="space-y-1 text-[9px] font-semibold text-gray-300">
                          <span>CVV</span>
                          <input type="password" value={payment.cvv} onChange={(event) => onPaymentChange('cvv', event.target.value)} autoComplete="cc-csc" inputMode="numeric" className={`w-full rounded-lg border bg-[#1c2032] px-3 py-2.5 text-xs text-white outline-none focus:border-red-500 ${paymentErrors.cvv ? 'border-red-500' : 'border-transparent'}`} />
                          {getFieldError(paymentErrors, 'cvv') && <span className="block text-red-400">{getFieldError(paymentErrors, 'cvv')}</span>}
                        </label>
                      </div>
                    </div>
                  </form>
                )}

                {bookingError && <div className="mt-3 rounded-lg bg-red-500/10 p-2.5 text-[10px] text-red-300">
                  <p role="alert">{bookingError}</p>
                  {bookingRetryAction && <button type="button" onClick={onRetryBooking} disabled={bookingLoading} className="mt-2 font-semibold underline disabled:opacity-50">{bookingLoading ? 'Retrying...' : 'Retry'}</button>}
                </div>}
                {releaseLoading && <p role="status" className="mt-3 text-center text-[10px] text-gray-400">Releasing seat hold...</p>}
                {isUnderAge && ageMessage && <p role="alert" className="mt-3 rounded-lg bg-amber-500/10 p-2.5 text-[10px] text-amber-300">{ageMessage}</p>}
              </div>

              <aside className="mt-4 flex min-w-0 flex-col border-t border-white/5 pt-4 lg:mt-0 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                <div>
                  <h3 className="text-[10px] font-bold">{step === 'seats' ? 'Your seats' : 'Summary'}{step === 'seats' && seatCap > 0 ? ` · Max ${seatCap}` : ''}</h3>
                  {step === 'seats' ? (
                    <>
                      <p className="mt-2 text-[9px] leading-relaxed text-gray-400">Pick up to {seatCap || 3} seats from the map. Each seat can carry its own ticket type.</p>
                      <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">
                        {ticketLines.map((ticket) => (
                          <div key={ticket.id} className="rounded-lg bg-[#1c2032] p-2.5">
                            <div className="flex items-center justify-between gap-2 text-[9px]">
                              <span className="text-gray-400">Seat: <strong className="ml-1 text-white">{ticket.code}</strong></span>
                              <span className="flex items-center gap-2 font-semibold text-white">{money(ticket.price)}<button type="button" onClick={() => onToggleSeat(seats.find((seat) => seatId(seat) === ticket.id))} aria-label={`Remove seat ${ticket.code}`} className="text-gray-500 hover:text-white">×</button></span>
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-1">
                              {ticketTypeOptions.map((type) => {
                                const isSelected = ticket.typeSlug === type.value;
                                return (
                                  <button key={type.value} type="button" onClick={() => onTicketTypeChange(ticket.id, type.value)} disabled={bookingLoading || Boolean(type.blockedFromRatingAge && Number(movie?.ageRating?.minAge || 0) >= type.blockedFromRatingAge)} className={`rounded-full px-1 py-1.5 text-[8px] transition disabled:cursor-not-allowed disabled:opacity-40 ${isSelected ? 'bg-[#f12d13] text-white' : 'bg-[#292d41] text-gray-300 hover:bg-[#363a50]'}`}>
                                    {type.label} {Math.round(ticketTypeOptions.find((item) => item.value === type.value)?.priceRatio * 100 || 100)}%
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="mt-3 rounded-lg bg-[#1c2032] p-3 text-[9px]">
                      <p className="font-bold">{title}</p>
                      <p className="mt-1 text-gray-400">{hall ? `Hall ${hall}` : venue} · {dateTime}</p>
                      <p className="mt-3 flex justify-between gap-3 text-gray-400"><span>Seats</span><span className="text-right text-white">{ticketLines.map((ticket) => ticket.code).join(', ')}</span></p>
                      <p className="mt-2 flex justify-between gap-3 text-gray-400"><span>Tickets</span><span className="text-right text-white">{ticketsDescription}</span></p>
                    </div>
                  )}
                </div>
                <div className="mt-auto pt-4">
                  <div className="mb-2 flex items-center justify-between text-[9px] font-semibold uppercase">
                    <span>Subtotal</span>
                    <span className="text-base font-bold normal-case">{money(subtotal)}</span>
                  </div>
                  {step === 'seats' ? (
                    <button type="button" onClick={submitHold} disabled={seatLoading || bookingLoading || !selectedSeats.length || isUnderAge} className="w-full rounded-full bg-[#f12d13] px-4 py-2.5 text-[10px] font-bold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-[#4d4f5d] disabled:text-gray-300">
                      {bookingLoading ? 'Holding seats...' : 'Next: Checkout'}
                    </button>
                  ) : (
                    <>
                      <button type="submit" form="booking-checkout-form" disabled={bookingLoading || !hold?.id} className="w-full rounded-full bg-[#f12d13] px-4 py-2.5 text-[10px] font-bold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-[#4d4f5d] disabled:text-gray-300">
                        {releaseLoading ? 'Releasing seats...' : bookingLoading ? 'Placing order...' : 'Pay: Complete order'}
                      </button>
                      <button type="button" onClick={backToSeats} disabled={bookingLoading} className="mt-2 w-full text-[9px] text-gray-400 hover:text-white disabled:cursor-wait disabled:opacity-50">{releaseLoading ? 'Releasing seats...' : 'Back to seats'}</button>
                    </>
                  )}
                </div>
              </aside>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
