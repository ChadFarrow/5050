// Add some basic interactivity
document.addEventListener('DOMContentLoaded', function() {
    // Add click handlers for buttons
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.addEventListener('click', function(e) {
            if (this.textContent.includes('Buy Tickets')) {
                alert('🎫 In the full app, this would open the ticket purchase dialog with Lightning payment integration!');
            } else if (this.textContent.includes('Create Fundraiser')) {
                alert('🎙️ In the full app, this would open the campaign creation form for podcasters!');
            } else if (this.textContent.includes('Connect Wallet')) {
                alert('⚡ In the full app, this would connect to your Nostr identity and Lightning wallet!');
            } else if (this.textContent.includes('View Demo')) {
                alert('🎮 In the full app, this would take you to an interactive demo with mock campaigns!');
            }
        });
    });

    // Add hover effects to campaign cards
    const cards = document.querySelectorAll('.bg-white');
    cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
        });
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });
});