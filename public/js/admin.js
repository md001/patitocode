'use strict';

function UserLogin() {
    document.addEventListener('DOMContentLoaded', function() {
        // Shortcuts to DOM Elements.
        this.signedOutCard = document.getElementById('signed-out-card');
        this.signInButton  = document.getElementById('sign-in-btn');

        this.signedInCard  = document.getElementById('signed-in-card');
        this.nameContainer = document.getElementById('signed-in-name');
        this.uidContainer  = document.getElementById('signed-in-uid');
        this.profilePic    = document.getElementById('signed-in-pic');
        this.signOutButton = document.getElementById('sign-out-btn');
        this.deleteButton  = document.getElementById('delete-acc-btn');
    
        // Bind events.
        this.signInButton.addEventListener('click', this.signIn.bind(this));
        this.signOutButton.addEventListener('click', this.signOut.bind(this));
        this.deleteButton.addEventListener('click', this.deleteAccount.bind(this));
        firebase.auth().onAuthStateChanged(this.onAuthStateChanged.bind(this));
    }.bind(this));
}
  
// Triggered on Firebase auth state change.
UserLogin.prototype.onAuthStateChanged = function(user) {
    if (user) {
        this.nameContainer.innerText = user.displayName;
        this.uidContainer.innerText = user.uid;
        this.profilePic.src = user.photoURL;
        this.signedOutCard.style.display = 'none';
        this.signedInCard.style.display = 'block';
    } else {
        this.signedOutCard.style.display = 'block';
        this.signedInCard.style.display = 'none';
    }
  };
  
// Initiates the sign-in flow using Google sign in in a popup.
UserLogin.prototype.signIn = function() {
    firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());
};
  
// Signs-out of Firebase.
UserLogin.prototype.signOut = function() {
    firebase.auth().signOut();
};

// Deletes the user's account.
UserLogin.prototype.deleteAccount = function() {
    firebase.auth().currentUser.delete().then(function() {
        window.alert('Account deleted.');
    }).catch(function(error) {
        if (error.code === 'auth/requires-recent-login') {
            window.alert('You need to have recently signed-in to delete your account. Please sign-in and try again.');
            firebase.auth().signOut();
        }
    });
};

// Load the UserLogin
window.userlogin = new UserLogin();
