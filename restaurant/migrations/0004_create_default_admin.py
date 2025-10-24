from django.db import migrations


def create_default_admin(apps, schema_editor):
    from django.contrib.auth import get_user_model
    User = get_user_model()
    username = 'Admin'
    password = 'admin123'
    email = 'admin@example.com'
    user, created = User.objects.get_or_create(username=username, defaults={
        'email': email,
        'is_staff': True,
        'is_superuser': True,
        'first_name': 'Admin',
        'last_name': 'User',
    })
    # Ensure superuser flags and password per requirement
    updated = False
    if not user.is_staff or not user.is_superuser:
        user.is_staff = True
        user.is_superuser = True
        updated = True
    # Always reset password to the required demo credential
    user.set_password(password)
    updated = True
    if updated:
        user.save()

    # Ensure Profile exists with admin role
    Profile = apps.get_model('restaurant', 'Profile')
    profile, _ = Profile.objects.get_or_create(user_id=user.pk, defaults={'role': 'admin'})
    if profile.role != 'admin':
        profile.role = 'admin'
        profile.save(update_fields=['role'])


def reverse_noop(apps, schema_editor):
    # Do not delete the admin user on reverse; keep it idempotent
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('restaurant', '0003_foodset_ingredient_menucategory_voucher_address_and_more'),
    ]

    operations = [
        migrations.RunPython(create_default_admin, reverse_noop),
    ]
