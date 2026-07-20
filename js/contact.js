/* Replace the body of this function with your backend endpoint when ready. */
async function submitForm(data) {
  // Example:
  // const response = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  // if (!response.ok) throw new Error('Unable to send your inquiry.');
  // return response.json();
  await new Promise(resolve => setTimeout(resolve, 1200)); // Demo-only loading state.
  return { success: true, data };
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#contact-form');
  if (!form) return;
  const button = form.querySelector('.contact-submit');
  const message = form.querySelector('.form-message');

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.checkValidity()) return form.reportValidity();
    const data = Object.fromEntries(new FormData(form).entries());

    button.disabled = true;
    button.classList.remove('is-success');
    button.classList.add('is-loading');
    message.textContent = '';
    message.classList.remove('is-error');

    try {
      await submitForm(data);
      button.classList.remove('is-loading');
      button.classList.add('is-success');
      message.textContent = 'Thanks — your inquiry is on its way.';
      form.reset();
      window.setTimeout(() => { button.classList.remove('is-success'); button.disabled = false; }, 1800);
    } catch (error) {
      button.classList.remove('is-loading');
      button.disabled = false;
      message.textContent = error.message || 'Something went wrong. Please try again.';
      message.classList.add('is-error');
    }
  });
});
