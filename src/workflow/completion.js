export function isConfirmedCompletion(status) {
  return ["Complete", "Sent", "Manually Confirmed", "Delivered"].includes(
    status,
  );
}
